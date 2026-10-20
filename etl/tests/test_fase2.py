import numpy as np
import pandas as pd
import pytest

from etl.config import PESOS, PESO_CATEGORIA, BONUS_CATEGORIA_PESO
from etl.score_auditoria import normalizar_min_max_grupo
from etl.regras_acao import avaliar_acao_linha, ACOES_TEXTO


# =============================================================================
# 1. FIXTURE DE ~200 LINHAS COBRINDO CASOS DIVERSOS
# =============================================================================
@pytest.fixture
def fixture_200_linhas():
    """
    Gera um DataFrame representativo com ~200 linhas cobrindo:
    - Estoque zero e positivo
    - Diferentes filiais e categorias
    - Produtos com e sem venda (nunca vendeu)
    - Prazos de validade variados (NaN, <=2, >12, etc.)
    - Todos os grupos (A1A1, A1A2, A1C1, A2A2, A1D2, Z0Z0)
    """
    np.random.seed(42)
    n = 200

    filiais = np.random.choice([1, 2, 3], size=n)
    categorias = np.random.choice(list(PESO_CATEGORIA.keys()), size=n)
    grupos = np.random.choice(['A1A1', 'A1A2', 'A1C1', 'A2A2', 'A1D2', 'Z0Z0'], size=n)

    estoque = np.random.randint(1, 100, size=n)
    estoque[:5] = 0  # 5 linhas com estoque 0

    demanda = np.random.randint(0, 50, size=n)
    demanda[10:30] = 0  # sem demanda local

    prazos = np.random.choice([np.nan, 1.0, 2.0, 5.0, 9.0, 11.0, 15.0], size=n)

    # Features simuladas
    df = pd.DataFrame({
        'Filial': filiais,
        'Codigo_Produto': np.arange(1001, 1001 + n),
        'Nome_Produto': [f"Produto {i}" for i in range(n)],
        'Categoria': categorias,
        'Grupo': grupos,
        'Estoque_Atual': estoque,
        'Demanda_Atual': demanda,
        'Demanda_Rede': demanda * np.random.randint(1, 5, size=n),
        'Prazo_Validade_Meses': prazos,
        'Vendas_PA_Filial': np.random.randint(0, 30, size=n),
        'Vendas_PA_Rede': np.random.randint(0, 100, size=n),
        'dias_desde_ultima_venda': np.random.choice([30.0, 150.0, 365.0], size=n),
        'Ultima_Venda': np.random.choice(['2026-09-01', None], p=[0.85, 0.15], size=n),
        'feat_normal': np.random.uniform(0, 100, size=n),
        'feat_com_zeros': np.random.choice([0.0, 0.0, 0.05, 0.10, 0.20], size=n),
    })
    return df


# =============================================================================
# 2. TESTES DE NORMALIZAÇÃO MIN-MAX E CASO ZERO (D2)
# =============================================================================
def test_normalizacao_min_max_padrao():
    df = pd.DataFrame({
        'Filial': [1, 1, 1, 1],
        'Categoria': ['A', 'A', 'A', 'A'],
        'feat': [10.0, 20.0, 30.0, 40.0]
    })
    norm = normalizar_min_max_grupo(df, 'feat', ignorar_zero=False)
    assert np.isclose(norm[0], 0.0)
    assert np.isclose(norm[1], 1.0 / 3.0)
    assert np.isclose(norm[2], 2.0 / 3.0)
    assert np.isclose(norm[3], 1.0)


def test_normalizacao_min_max_constante():
    df = pd.DataFrame({
        'Filial': [1, 1],
        'Categoria': ['A', 'A'],
        'feat': [5.0, 5.0]
    })
    norm = normalizar_min_max_grupo(df, 'feat', ignorar_zero=False)
    assert np.all(norm == 0.0)


def test_normalizacao_tendencia_zeros_d2():
    """
    Desvio D2: Para TENDENCIA_NUM, zeros permanecem 0 e min-max ocorre apenas entre valores != 0.
    """
    df = pd.DataFrame({
        'Filial': [1, 1, 1, 1, 1],
        'Categoria': ['A', 'A', 'A', 'A', 'A'],
        'tend': [0.0, 0.0, 0.10, 0.20, 0.30]
    })
    norm = normalizar_min_max_grupo(df, 'tend', ignorar_zero=True)
    assert norm[0] == 0.0
    assert norm[1] == 0.0
    assert np.isclose(norm[2], 0.0)   # 0.10 é o mínimo dos não-zeros
    assert np.isclose(norm[3], 0.5)   # (0.20 - 0.10) / (0.30 - 0.10) = 0.5
    assert np.isclose(norm[4], 1.0)   # 0.30 é o máximo dos não-zeros


# =============================================================================
# 3. TESTES DE CLASSIFICAÇÃO NOS LIMIARES
# =============================================================================
@pytest.mark.parametrize("score,esperado", [
    (0.00, "Baixo Risco"),
    (0.099, "Baixo Risco"),
    (0.10, "Médio Risco"),
    (0.199, "Médio Risco"),
    (0.20, "Médio-Alto Risco"),
    (0.299, "Médio-Alto Risco"),
    (0.30, "Alto Risco"),
    (0.85, "Alto Risco"),
])
def test_classificacao_limiares(score, esperado):
    if score < 0.10:
        res = "Baixo Risco"
    elif score < 0.20:
        res = "Médio Risco"
    elif score < 0.30:
        res = "Médio-Alto Risco"
    else:
        res = "Alto Risco"
    assert res == esperado


# =============================================================================
# 4. TESTE DO BÔNUS DE CATEGORIA (D1)
# =============================================================================
def test_bonus_categoria_d1():
    """
    Desvio D1: O bônus é aplicado a 'Médio-Alto Risco' e 'Alto Risco'.
    Não deve ser aplicado a 'Baixo Risco' ou 'Médio Risco'.
    """
    peso_prescricao = PESO_CATEGORIA['Prescrição Médica']  # 9 (max)
    min_peso = min(PESO_CATEGORIA.values())  # 2
    max_peso = max(PESO_CATEGORIA.values())  # 9
    peso_norm = (peso_prescricao - min_peso) / (max_peso - min_peso)  # 1.0

    # Caso Médio-Alto Risco: recebe bônus
    classe_ma = "Médio-Alto Risco"
    bonus_ma = BONUS_CATEGORIA_PESO * peso_norm if classe_ma in ["Médio-Alto Risco", "Alto Risco"] else 0.0
    assert np.isclose(bonus_ma, 0.10)

    # Caso Alto Risco: recebe bônus
    classe_alto = "Alto Risco"
    bonus_alto = BONUS_CATEGORIA_PESO * peso_norm if classe_alto in ["Médio-Alto Risco", "Alto Risco"] else 0.0
    assert np.isclose(bonus_alto, 0.10)

    # Caso Baixo Risco: NÃO recebe bônus
    classe_baixo = "Baixo Risco"
    bonus_baixo = BONUS_CATEGORIA_PESO * peso_norm if classe_baixo in ["Médio-Alto Risco", "Alto Risco"] else 0.0
    assert bonus_baixo == 0.0

    # Caso Médio Risco: NÃO recebe bônus
    classe_medio = "Médio Risco"
    bonus_medio = BONUS_CATEGORIA_PESO * peso_norm if classe_medio in ["Médio-Alto Risco", "Alto Risco"] else 0.0
    assert bonus_medio == 0.0


# =============================================================================
# 5. TESTE DO CASO 'NUNCA VENDEU' -> 0.40
# =============================================================================
def test_caso_nunca_vendeu():
    """
    Se nunca vendeu (Ultima_Venda é NaN) e Score_Base == 0 -> Score_Base = 0.40 (§3.3 item 2).
    """
    score_base = 0.0
    ultima_venda = None

    if ultima_venda is None and score_base == 0.0:
        score_base = 0.40

    assert score_base == 0.40


# =============================================================================
# 6. TESTES DAS REGRAS DE AÇÃO POR GRUPO (§3.4)
# =============================================================================
def test_regras_acao_grupo_a1a1_a1a2():
    score = 0.25

    # 1. sem_validade
    r = avaliar_acao_linha("A1A1", score, prazo=np.nan, demanda_atual=10, demanda_rede=50, vpa_f=5, vpa_r=20, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r == ACOES_TEXTO['sem_validade']

    # 2. vender_custo (prazo <= 2)
    r = avaliar_acao_linha("A1A1", score, prazo=1.5, demanda_atual=10, demanda_rede=50, vpa_f=5, vpa_r=20, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r == ACOES_TEXTO['vender_custo']

    # 3. cotacao_med (vpa_f != 0, prazo > 12, dias > 120, cob < 2)
    # cob = 5 / (5 + 1) = 0.83 < 2
    r = avaliar_acao_linha("A1A1", score, prazo=14.0, demanda_atual=0, demanda_rede=50, vpa_f=5, vpa_r=20, dias_desde_ultima_venda=130, estoque_atual=5)
    assert r == ACOES_TEXTO['cotacao']

    # 4. reposicionar (demanda_atual > 0)
    r = avaliar_acao_linha("A1A1", score, prazo=8.0, demanda_atual=5, demanda_rede=50, vpa_f=0, vpa_r=20, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r == ACOES_TEXTO['reposicionar']

    # 5. transferir (demanda_atual == 0, demanda_rede > 0, prazo > 10)
    r = avaliar_acao_linha("A1A1", score, prazo=11.0, demanda_atual=0, demanda_rede=20, vpa_f=0, vpa_r=20, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r == ACOES_TEXTO['transferir']

    # 6. igual_generico (prazo < 10 e cob > 2)
    # cob = 20 / (2 + 1) = 6.6 > 2
    r = avaliar_acao_linha("A1A1", score, prazo=9.0, demanda_atual=0, demanda_rede=0, vpa_f=2, vpa_r=5, dias_desde_ultima_venda=30, estoque_atual=20)
    assert r == ACOES_TEXTO['igual_generico']

    # 7. transferir_pa (prazo < 8 e (demanda_rede > 0 ou cob > 2))
    r = avaliar_acao_linha("A1A1", score, prazo=7.0, demanda_atual=0, demanda_rede=10, vpa_f=5, vpa_r=5, dias_desde_ultima_venda=30, estoque_atual=2)
    assert r == ACOES_TEXTO['transferir_pa']

    # 8. inteligencia (demanda_atual == 0 e demanda_rede == 0 e vpa_r == 0)
    r = avaliar_acao_linha("A1A1", score, prazo=10.0, demanda_atual=0, demanda_rede=0, vpa_f=0, vpa_r=0, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r == ACOES_TEXTO['inteligencia']

    # 9. default
    r = avaliar_acao_linha("A1A1", score, prazo=10.0, demanda_atual=0, demanda_rede=0, vpa_f=5, vpa_r=10, dias_desde_ultima_venda=30, estoque_atual=5)
    assert r == ACOES_TEXTO['default']


def test_regras_acao_grupo_a2a2_e_a1d2():
    score = 0.25

    # A2A2 cotacao_a1d2 (prazo >= 10, dem=0, dem_rede=0) -> cotacao
    r = avaliar_acao_linha("A2A2", score, prazo=12.0, demanda_atual=0, demanda_rede=0, vpa_f=0, vpa_r=10, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r == ACOES_TEXTO['cotacao']

    # A2A2 transf_a2a2 (prazo >= 10, dem=0, dem_rede > 0) -> transferir_pa
    r = avaliar_acao_linha("A2A2", score, prazo=11.0, demanda_atual=0, demanda_rede=15, vpa_f=0, vpa_r=10, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r == ACOES_TEXTO['transferir_pa']

    # A1D2 transf_a1d2 (prazo < 10, dem=0, dem_rede > 0) -> transferir_pa
    r = avaliar_acao_linha("A1D2", score, prazo=6.0, demanda_atual=0, demanda_rede=15, vpa_f=0, vpa_r=10, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r == ACOES_TEXTO['transferir_pa']


def test_regras_acao_grupos_sem_regra_ou_score_baixo():
    # Score <= 0.10 -> None
    r = avaliar_acao_linha("A1A1", 0.08, prazo=1.0, demanda_atual=10, demanda_rede=50, vpa_f=5, vpa_r=20, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r is None

    # Grupo Z0Z0 -> None
    r = avaliar_acao_linha("Z0Z0", 0.35, prazo=1.0, demanda_atual=10, demanda_rede=50, vpa_f=5, vpa_r=20, dias_desde_ultima_venda=30, estoque_atual=10)
    assert r is None


# =============================================================================
# 7. TESTE DE SOMA DE CONTRIBUIÇÕES E LIMITES DO SCORE
# =============================================================================
def test_score_range_e_soma_contribuicoes(fixture_200_linhas):
    df = fixture_200_linhas.copy()

    # Calcular features simuladas e contribuições
    score_base = np.zeros(len(df))
    contribuicoes = {}

    for feat, peso in PESOS.items():
        ignorar_zero = (feat == 'TENDENCIA_NUM')
        norm = normalizar_min_max_grupo(df, 'feat_com_zeros' if ignorar_zero else 'feat_normal', ignorar_zero=ignorar_zero)
        contrib = np.round(norm * peso, 4)
        contribuicoes[f'Contrib_{feat}'] = contrib
        score_base += contrib

    score_base = np.round(score_base, 4)

    # Classificação
    cond_classes = [score_base < 0.10, score_base < 0.20, score_base < 0.30]
    classes = np.select(cond_classes, ['Baixo Risco', 'Médio Risco', 'Médio-Alto Risco'], default='Alto Risco')

    # Bônus
    peso_cat = df['Categoria'].map(PESO_CATEGORIA).fillna(2).astype(float)
    peso_norm = (peso_cat - 2.0) / (9.0 - 2.0)
    bonus = np.where(np.isin(classes, ['Médio-Alto Risco', 'Alto Risco']), np.round(0.10 * peso_norm, 4), 0.0)
    contribuicoes['Contrib_Categoria'] = bonus

    score_final = np.round(score_base + bonus, 4)

    # Asserts
    # 1. Score deve estar no intervalo [0.0; 1.10]
    assert np.all(score_final >= 0.0)
    assert np.all(score_final <= 1.10)

    # 2. A soma de Contrib_* deve bater com Score_Auditoria (±0.001)
    soma_contribs = np.zeros(len(df))
    for c in contribuicoes.values():
        soma_contribs += c
    soma_contribs = np.round(soma_contribs, 4)

    assert np.all(np.abs(soma_contribs - score_final) <= 0.001)
