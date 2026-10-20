import pandas as pd
from typing import Optional, Dict, Any

# Textos exatos das ações para exibição na UI (§3.4)
ACOES_TEXTO = {
    'sem_validade': "Produto sem validade informada: solicitar à filial o cadastro",
    'vender_custo': "Produto crítico: vender abaixo do custo (última prioridade)",
    'cotacao': "Cotação do produto no mercado e avaliar ajuste de preço",
    'reposicionar': "Reposicionar e priorizar venda / Filial acompanhar a saída do produto",
    'transferir': "Transferir para filial/loja com demanda do SKU",
    'igual_generico': "Igualar a apresentação genérica mais vendida; posicionar o produto acima ou à frente / Filial acompanhar",
    'transferir_pa': "Transferir para filial/loja com demanda do princípio ativo",
    'inteligencia': "Acionar Inteligência de Mercado ou representante do fabricante",
    'default': "O comprador deve comunicar os médicos para gerar prescrição médica e bloquear a compra do produto",
}


def avaliar_acao_linha(
    grupo: str,
    score_auditoria: float,
    prazo: float,
    demanda_atual: float,
    demanda_rede: float,
    vpa_f: float,
    vpa_r: float,
    dias_desde_ultima_venda: float,
    estoque_atual: float
) -> Optional[str]:
    """
    Avalia a regra de ação para uma linha individual conforme a especificação do §3.4.
    Aplica apenas se score_auditoria > 0.10 e o grupo tiver regras mapeadas.
    Primeira condição verdadeira vence. Comparações com prazo NaN são falsas.
    """
    if pd.isna(score_auditoria) or score_auditoria <= 0.10:
        return None

    if not isinstance(grupo, str) or not grupo.startswith('A'):
        return None

    tem_prazo = pd.notna(prazo)
    cob = estoque_atual / (vpa_f + 1.0)

    # Condições primitivas (§3.4)
    c_sem_validade = not tem_prazo
    c_vender_custo = tem_prazo and (prazo <= 2.0)
    c_cotacao_med = (vpa_f != 0.0) and tem_prazo and (prazo > 12.0) and (dias_desde_ultima_venda > 120.0) and (cob < 2.0)
    c_reposicionar = demanda_atual > 0.0
    c_transferir = (demanda_atual == 0.0) and (demanda_rede > 0.0) and tem_prazo and (prazo > 10.0)
    c_igual_generico = tem_prazo and (prazo < 10.0) and (cob > 2.0)
    c_transferir_pa = tem_prazo and (prazo < 8.0) and ((demanda_rede > 0.0) or (cob > 2.0))
    c_inteligencia = (demanda_atual == 0.0) and (demanda_rede == 0.0) and (vpa_r == 0.0)
    c_cotacao_a1d2 = tem_prazo and (prazo >= 10.0) and (demanda_atual == 0.0) and (demanda_rede == 0.0)
    c_transf_a2a2 = tem_prazo and (prazo >= 10.0) and (demanda_atual == 0.0) and ((demanda_rede > 0.0) or (cob > 2.0))
    c_transf_a1d2 = tem_prazo and (prazo < 10.0) and (demanda_atual == 0.0) and ((demanda_rede > 0.0) or (cob > 2.0))

    if grupo in ('A1A1', 'A1A2'):
        if c_sem_validade:
            return ACOES_TEXTO['sem_validade']
        if c_vender_custo:
            return ACOES_TEXTO['vender_custo']
        if c_cotacao_med:
            return ACOES_TEXTO['cotacao']
        if c_reposicionar:
            return ACOES_TEXTO['reposicionar']
        if c_transferir:
            return ACOES_TEXTO['transferir']
        if c_igual_generico:
            return ACOES_TEXTO['igual_generico']
        if c_transferir_pa:
            return ACOES_TEXTO['transferir_pa']
        if c_inteligencia:
            return ACOES_TEXTO['inteligencia']
        return ACOES_TEXTO['default']

    elif grupo == 'A1C1':
        if c_sem_validade:
            return ACOES_TEXTO['sem_validade']
        if c_vender_custo:
            return ACOES_TEXTO['vender_custo']
        if c_cotacao_med:
            return ACOES_TEXTO['cotacao']
        if c_reposicionar:
            return ACOES_TEXTO['reposicionar']
        if c_inteligencia:
            return ACOES_TEXTO['inteligencia']
        if c_transferir:
            return ACOES_TEXTO['transferir']
        return None

    elif grupo == 'A2A2':
        # 2ª definição do notebook prevalece (§3.4)
        if c_sem_validade:
            return ACOES_TEXTO['sem_validade']
        if c_cotacao_a1d2:
            return ACOES_TEXTO['cotacao']
        if c_transf_a2a2:
            return ACOES_TEXTO['transferir_pa']
        return None

    elif grupo == 'A1D2':
        if c_sem_validade:
            return ACOES_TEXTO['sem_validade']
        if c_cotacao_a1d2:
            return ACOES_TEXTO['cotacao']
        if c_transf_a1d2:
            return ACOES_TEXTO['transferir_pa']
        return None

    return None


def aplicar_regras_acao(df: pd.DataFrame) -> pd.Series:
    """
    Aplica as regras de ação recomendada a todo o DataFrame de forma eficiente.
    """
    # Filtrar apenas linhas elegíveis para acelerar a execução
    mask_elegivel = (df['Score_Auditoria'] > 0.10) & (df['Grupo'].str.startswith('A', na=False))
    acoes = pd.Series(None, index=df.index, dtype=object)

    if not mask_elegivel.any():
        return acoes

    df_sub = df[mask_elegivel]

    # Vetores para acesso rápido
    grupos = df_sub['Grupo'].values
    scores = df_sub['Score_Auditoria'].values
    prazos = df_sub['Prazo_Validade_Meses'].values
    dem_atual = df_sub['Demanda_Atual'].values
    dem_rede = df_sub['Demanda_Rede'].values
    vpa_f = df_sub['Vendas_PA_Filial'].values
    vpa_r = df_sub['Vendas_PA_Rede'].values
    dias_venda = df_sub['dias_desde_ultima_venda'].values
    est_atual = df_sub['Estoque_Atual'].values

    resultado_sub = [
        avaliar_acao_linha(g, sc, pr, da, dr, vf, vr, dv, ea)
        for g, sc, pr, da, dr, vf, vr, dv, ea in zip(
            grupos, scores, prazos, dem_atual, dem_rede, vpa_f, vpa_r, dias_venda, est_atual
        )
    ]

    acoes.loc[mask_elegivel] = resultado_sub
    return acoes
