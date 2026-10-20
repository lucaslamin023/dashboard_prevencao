import argparse
import sys
from pathlib import Path
import numpy as np
import pandas as pd

# Reconfigure stdout/stderr for UTF-8 on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Add parent directory to path to allow direct execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.config import (
    DIR_CONSOLIDADOS,
    DATA_REFERENCIA,
    TOTAL_FILIAIS,
    LIMIAR_TENDENCIA,
)


def validar_fase_1(data_dir: Path) -> bool:
    print("\n" + "=" * 60)
    print("VALIDAÇÃO DOS INVARIANTES — FASE 1")
    print(f"Diretório de dados: {data_dir}")
    print(f"Data de Referência: {DATA_REFERENCIA}")
    print("=" * 60)

    erros = []

    # 1. Carregar Dimensões e Universo
    print("\n[Carregando datasets consolidados...]")
    p_est = data_dir / "fEstoqueDemanda.csv"
    p_filial = data_dir / "dFilial.csv"
    p_prod = data_dir / "dProdutos.csv"
    p_cal = data_dir / "dCalendario.csv"
    p_vend = data_dir / "dVendedores.csv"
    p_av = data_dir / "fAVencer.csv"
    p_vendas = data_dir / "fVendas.csv"
    p_perdas = data_dir / "fPerdasTotais.csv"
    p_mov = data_dir / "fMovimentacao.csv"
    p_div = data_dir / "fDivergenciasInventario.csv"
    p_res = data_dir / "fResultadoInventario.csv"
    p_bon = data_dir / "fBonificacao.csv"

    arquivos = [p_est, p_filial, p_prod, p_cal, p_vend, p_av, p_vendas, p_perdas, p_mov, p_div, p_res, p_bon]
    for p in arquivos:
        if not p.exists():
            erros.append(f"Arquivo obrigatório não encontrado: {p.name}")

    if erros:
        for e in erros:
            print(f"  ❌ {e}")
        return False

    df_est = pd.read_csv(p_est)
    df_filial = pd.read_csv(p_filial)
    df_prod = pd.read_csv(p_prod, dtype={'MG': str})
    df_cal = pd.read_csv(p_cal)
    df_vend = pd.read_csv(p_vend)
    df_av = pd.read_csv(p_av)
    df_vendas = pd.read_csv(p_vendas)
    df_perdas = pd.read_csv(p_perdas)
    df_mov = pd.read_csv(p_mov)
    df_div = pd.read_csv(p_div)
    df_res = pd.read_csv(p_res)
    df_bon = pd.read_csv(p_bon)

    # -------------------------------------------------------------
    # I1: (Filial, Codigo_Produto) único em fEstoqueDemanda; 232 filiais presentes
    # -------------------------------------------------------------
    print("\n--- [I1] Chave única e cobertura de 232 filiais em fEstoqueDemanda ---")
    duplicados = df_est.duplicated(subset=['Filial', 'Codigo_Produto']).sum()
    filiais_presentes = df_est['Filial'].nunique()
    filiais_esperadas = set(range(1, TOTAL_FILIAIS + 1))
    filiais_faltantes = filiais_esperadas - set(df_est['Filial'].unique())

    if duplicados == 0:
        print(f"  ✅ Chave (Filial, Codigo_Produto) é única: 0 duplicatas em {len(df_est):,} linhas.")
    else:
        erros.append(f"I1: Encontradas {duplicados:,} duplicatas de (Filial, Codigo_Produto).")
        print(f"  ❌ {erros[-1]}")

    if filiais_presentes == TOTAL_FILIAIS and len(filiais_faltantes) == 0:
        print(f"  ✅ Todas as {TOTAL_FILIAIS} filiais (1..{TOTAL_FILIAIS}) estão presentes.")
    else:
        erros.append(f"I1: Filiais ausentes: {sorted(filiais_faltantes)}")
        print(f"  ❌ {erros[-1]}")

    # -------------------------------------------------------------
    # I2: 100% das chaves existem no universo; FKs existem nas dimensões
    # -------------------------------------------------------------
    print("\n--- [I2] Integridade referencial com Universo e Dimensões ---")
    # Universo como set de tuplas para lookup O(1)
    universo_chaves = set(zip(df_est['Filial'], df_est['Codigo_Produto']))
    dim_filiais = set(df_filial['Filial'].unique())
    dim_produtos = set(df_prod['Codigo_Produto'].unique())
    dim_vendedores = set(df_vend['ID_Vendedor'].unique())

    # Universo FKs
    est_filial_fk = set(df_est['Filial'].unique()) - dim_filiais
    est_prod_fk = set(df_est['Codigo_Produto'].unique()) - dim_produtos
    if est_filial_fk or est_prod_fk:
        erros.append(f"I2: fEstoqueDemanda possui FKs inexistentes (filial: {len(est_filial_fk)}, prod: {len(est_prod_fk)})")
        print(f"  ❌ {erros[-1]}")
    else:
        print("  ✅ fEstoqueDemanda: 100% das FKs existem nas dimensões.")

    # fAVencer
    av_chaves = set(zip(df_av['Filial'], df_av['Codigo_Produto']))
    av_fora_universo = av_chaves - universo_chaves
    if av_fora_universo:
        erros.append(f"I2: fAVencer tem {len(av_fora_universo):,} pares fora do universo.")
        print(f"  ❌ {erros[-1]}")
    else:
        print(f"  ✅ fAVencer: 100% dos pares ({len(df_av):,} linhas) pertencem ao universo.")

    # fVendas
    vendas_chaves = set(zip(df_vendas['Filial'], df_vendas['Codigo_Produto']))
    vendas_fora = vendas_chaves - universo_chaves
    vendas_vend_fk = set(df_vendas['ID_Vendedor'].unique()) - dim_vendedores
    if vendas_fora or vendas_vend_fk:
        erros.append(f"I2: fVendas tem {len(vendas_fora):,} pares fora do universo ou {len(vendas_vend_fk)} vendedores inválidos.")
        print(f"  ❌ {erros[-1]}")
    else:
        print(f"  ✅ fVendas: 100% dos pares ({len(df_vendas):,} linhas) e vendedores pertencem ao universo.")

    # fPerdasTotais
    perdas_chaves = set(zip(df_perdas['Filial'], df_perdas['Codigo_Produto']))
    perdas_fora = perdas_chaves - universo_chaves
    if perdas_fora:
        erros.append(f"I2: fPerdasTotais tem {len(perdas_fora):,} pares fora do universo.")
        print(f"  ❌ {erros[-1]}")
    else:
        print(f"  ✅ fPerdasTotais: 100% dos pares ({len(df_perdas):,} linhas) pertencem ao universo.")

    # fMovimentacao
    mov_chaves = set(zip(df_mov['Filial'], df_mov['Codigo_Produto']))
    mov_fora = mov_chaves - universo_chaves
    if mov_fora:
        erros.append(f"I2: fMovimentacao tem {len(mov_fora):,} pares fora do universo.")
        print(f"  ❌ {erros[-1]}")
    else:
        print(f"  ✅ fMovimentacao: 100% dos pares ({len(df_mov):,} linhas) pertencem ao universo.")

    # fDivergenciasInventario
    div_chaves = set(zip(df_div['Filial'], df_div['Codigo_Produto']))
    div_fora = div_chaves - universo_chaves
    if div_fora:
        erros.append(f"I2: fDivergenciasInventario tem {len(div_fora):,} pares fora do universo.")
        print(f"  ❌ {erros[-1]}")
    else:
        print(f"  ✅ fDivergenciasInventario: 100% dos pares ({len(df_div):,} linhas) pertencem ao universo.")

    # -------------------------------------------------------------
    # I3: Nenhuma data > DATA_REFERENCIA; Vencimento ∈ [2026-08-31; 2028-03-31]
    # -------------------------------------------------------------
    print("\n--- [I3] Limites temporais e validade de lotes ---")
    data_ref = DATA_REFERENCIA
    tabelas_datas = [
        ("dCalendario", df_cal['Data'].max()),
        ("fVendas", df_vendas['Data_Venda'].max()),
        ("fPerdasTotais", df_perdas['Emissao_Data'].max()),
        ("fDivergenciasInventario", df_div['Data'].max()),
        ("fResultadoInventario", df_res['Data'].max()),
        ("fBonificacao", df_bon['Data'].max()),
        ("fMovimentacao (Ultima_Venda)", df_mov['Ultima_Venda'].dropna().max()),
        ("fMovimentacao (Ultima_Entrada)", df_mov['Ultima_Entrada'].dropna().max()),
    ]

    for nome_tab, max_data in tabelas_datas:
        if str(max_data) > data_ref:
            erros.append(f"I3: {nome_tab} contém data máxima {max_data} > {data_ref}")
            print(f"  ❌ {erros[-1]}")
        else:
            print(f"  ✅ {nome_tab}: max data = {max_data} (<= {data_ref})")

    min_venc = df_av['Vencimento'].min()
    max_venc = df_av['Vencimento'].max()
    if min_venc < "2026-08-31" or max_venc > "2028-03-31":
        erros.append(f"I3: fAVencer.Vencimento fora do intervalo [{min_venc}; {max_venc}] (esperado [2026-08-31; 2028-03-31])")
        print(f"  ❌ {erros[-1]}")
    else:
        print(f"  ✅ fAVencer: Vencimento ∈ [{min_venc}; {max_venc}] dentro de [2026-08-31; 2028-03-31].")

    # -------------------------------------------------------------
    # I4: Resolvido contém SIM e NÃO; soma fAVencer.Estoque por par <= Estoque_Atual
    # -------------------------------------------------------------
    print("\n--- [I4] Integridade de lotes fAVencer e consistência com estoque ---")
    resolvido_vals = set(df_av['Resolvido'].unique())
    if {'SIM', 'NÃO'}.issubset(resolvido_vals):
        pct_sim = (df_av['Resolvido'] == 'SIM').mean() * 100
        print(f"  ✅ fAVencer.Resolvido contém SIM ({pct_sim:.1f}%) e NÃO ({100-pct_sim:.1f}%).")
    else:
        erros.append(f"I4: Resolvido não contém ambos SIM e NÃO: {resolvido_vals}")
        print(f"  ❌ {erros[-1]}")

    av_soma_par = df_av.groupby(['Filial', 'Codigo_Produto'])['Estoque'].sum().reset_index()
    av_soma_par = av_soma_par.rename(columns={'Estoque': 'Estoque_AV'})
    merged_est = df_est.merge(av_soma_par, on=['Filial', 'Codigo_Produto'], how='inner')
    inconsistencias_est = (merged_est['Estoque_AV'] > merged_est['Estoque_Atual']).sum()

    if inconsistencias_est == 0:
        print(f"  ✅ Todos os {len(merged_est):,} pares com lote têm soma(Estoque_AV) <= Estoque_Atual.")
    else:
        erros.append(f"I4: {inconsistencias_est:,} pares têm soma(Estoque_AV) > Estoque_Atual.")
        print(f"  ❌ {erros[-1]}")

    # -------------------------------------------------------------
    # I5: Perdas/Faturamento mensal <= 3% em todos os meses com vendas
    # -------------------------------------------------------------
    print("\n--- [I5] Razão Perdas / Faturamento mensal <= 3% ---")
    df_vendas['Mes'] = pd.to_datetime(df_vendas['Data_Venda']).dt.to_period('M')
    df_perdas['Mes'] = pd.to_datetime(df_perdas['Emissao_Data']).dt.to_period('M')

    fat_mensal = df_vendas.groupby('Mes')['Valor_Total'].sum()
    perdas_mensal = df_perdas.groupby('Mes')['Valor_Perda'].sum()

    df_mensal = pd.DataFrame({'Faturamento': fat_mensal, 'Perdas': perdas_mensal}).fillna(0)
    df_mensal = df_mensal[df_mensal['Faturamento'] > 0]
    df_mensal['Perc_Perda'] = (df_mensal['Perdas'] / df_mensal['Faturamento']) * 100

    max_perc = df_mensal['Perc_Perda'].max()
    pior_mes = df_mensal['Perc_Perda'].idxmax()
    if max_perc <= 3.0:
        print(f"  ✅ Perdas/Faturamento mensal: máx = {max_perc:.2f}% (no mês {pior_mes}), todos <= 3.0%.")
    else:
        erros.append(f"I5: Mês {pior_mes} excedeu 3%: Perdas/Faturamento = {max_perc:.2f}%")
        print(f"  ❌ {erros[-1]}")

    # -------------------------------------------------------------
    # I6: >= 5% dos pares com perdas têm |tendência| >= 0,05
    # -------------------------------------------------------------
    print("\n--- [I6] Tendência de perda nos pares com perdas ---")
    dt_ref = pd.to_datetime(DATA_REFERENCIA)
    dt_janela_inicio = dt_ref - pd.DateOffset(days=365)

    df_perdas_dt = df_perdas.copy()
    df_perdas_dt['Emissao_Data_DT'] = pd.to_datetime(df_perdas_dt['Emissao_Data'])
    janela_mask = (df_perdas_dt['Emissao_Data_DT'] >= dt_janela_inicio) & (df_perdas_dt['Emissao_Data_DT'] <= dt_ref)
    df_perdas_janela = df_perdas_dt[janela_mask].copy()

    df_perdas_janela['MES'] = df_perdas_janela['Emissao_Data_DT'].dt.to_period('M').dt.to_timestamp()

    # Cálculo da tendência por produto (cov / var)
    def calc_slope(grupo):
        if len(grupo) < 2:
            return 0.0
        x = (grupo['MES'] - grupo['MES'].min()).dt.days.values
        var_x = np.var(x, ddof=1)
        if var_x == 0:
            return 0.0
        y = grupo['Quantidade'].values
        cov_xy = np.cov(x, y)[0, 1]
        slope = cov_xy / var_x
        return slope if abs(slope) >= LIMIAR_TENDENCIA else 0.0

    slopes_prod = df_perdas_janela.groupby('Codigo_Produto').apply(calc_slope, include_groups=False)
    slopes_prod.name = 'Tendencia_Slope'

    # Pares únicos em fPerdasTotais
    pares_perdas = df_perdas[['Filial', 'Codigo_Produto']].drop_duplicates()
    pares_perdas = pares_perdas.merge(slopes_prod, on='Codigo_Produto', how='left')
    pares_perdas['Tendencia_Slope'] = pares_perdas['Tendencia_Slope'].fillna(0.0)

    total_pares_perdas = len(pares_perdas)
    pares_com_tendencia = (pares_perdas['Tendencia_Slope'].abs() >= LIMIAR_TENDENCIA).sum()
    pct_pares_tendencia = (pares_com_tendencia / total_pares_perdas) * 100 if total_pares_perdas > 0 else 0

    if pct_pares_tendencia >= 5.0:
        print(f"  ✅ Pares com perdas com |tendência| >= 0,05: {pct_pares_tendencia:.2f}% ({pares_com_tendencia:,}/{total_pares_perdas:,} pares), meta >= 5.0%.")
    else:
        erros.append(f"I6: Apenas {pct_pares_tendencia:.2f}% dos pares com perda têm |tendência| >= 0,05 (esperado >= 5.0%).")
        print(f"  ❌ {erros[-1]}")

    # -------------------------------------------------------------
    # I7: Participações: Demanda_Atual=0 ∈ [15%;25%]; Estoque=0 ∈ [1%;2,5%]; vendas AV = 20% ±1pp
    # -------------------------------------------------------------
    print("\n--- [I7] Distribuição de Demanda=0, Estoque=0 e Vendas AV ---")
    tot_universo = len(df_est)
    pct_dem_zero = (df_est['Demanda_Atual'] == 0).mean() * 100
    pct_est_zero = (df_est['Estoque_Atual'] == 0).mean() * 100
    pct_vendas_av = (df_vendas['Is_Venda_AV'] == 1).mean() * 100

    if 15.0 <= pct_dem_zero <= 25.0:
        print(f"  ✅ Demanda_Atual = 0: {pct_dem_zero:.2f}% (esperado [15%; 25%]).")
    else:
        erros.append(f"I7: Demanda_Atual = 0 está em {pct_dem_zero:.2f}% (esperado [15%; 25%]).")
        print(f"  ❌ {erros[-1]}")

    if 1.0 <= pct_est_zero <= 2.5:
        print(f"  ✅ Estoque_Atual = 0: {pct_est_zero:.2f}% (esperado [1%; 2,5%]).")
    else:
        erros.append(f"I7: Estoque_Atual = 0 está em {pct_est_zero:.2f}% (esperado [1%; 2,5%]).")
        print(f"  ❌ {erros[-1]}")

    if 19.0 <= pct_vendas_av <= 21.0:
        print(f"  ✅ Vendas AV: {pct_vendas_av:.2f}% (esperado 20% ± 1pp).")
    else:
        erros.append(f"I7: Vendas AV está em {pct_vendas_av:.2f}% (esperado 20% ± 1pp).")
        print(f"  ❌ {erros[-1]}")

    print("\n" + "=" * 60)
    if erros:
        print(f"RESULTADO: ❌ FALHA ({len(erros)} erros encontrados)")
        for e in erros:
            print(f" - {e}")
        print("=" * 60)
        return False
    else:
        print("RESULTADO: ✅ SUCESSO! Todos os invariantes I1..I7 foram validados com êxito.")
        print("=" * 60)
        return True


def validar_fase_2(data_dir: Path) -> bool:
    print("\n" + "=" * 60)
    print("VALIDAÇÃO DOS INVARIANTES E DISTRIBUIÇÕES — FASE 2")
    print(f"Diretório de dados: {data_dir}")
    print("=" * 60)

    erros = []

    p_ind = data_dir / "fIndicadores_ML.csv"
    p_est = data_dir / "fEstoqueDemanda.csv"

    if not p_ind.exists():
        print(f"  ❌ Arquivo obrigatório não encontrado: {p_ind.name}")
        return False

    df_ind = pd.read_csv(p_ind, low_memory=False)
    n_total = len(df_ind)
    print(f"\n[Dataset carregado: {n_total:,} linhas]")

    # -------------------------------------------------------------
    # 1. Verificação de Colunas (54 colunas exatas conforme §3.7)
    # -------------------------------------------------------------
    print("\n--- [1] Verificação das 54 colunas obrigatórias (§3.7) ---")
    colunas_esperadas = [
        # Existentes (21)
        'Filial', 'Codigo_Produto', 'Nome_Produto', 'Categoria', 'Comprador',
        'Estoque_Atual', 'Demanda_Atual', 'Demanda_Ponderada', 'Dias_Cobertura',
        'Status_Ruptura', 'Qtd_Estoque_Excesso', 'Nivel_Excesso', 'Indice_Excesso_Filial_Perc',
        'Qtd_AV', 'Valor_AV', 'Qtd_Vendas_Normais', 'Qtd_Vendas_AV', 'Qtd_Perdas', 'Valor_Perdas',
        'Score_Risco_Perda_ML', 'Categoria_Risco_Perda',
        # Novas colunas de negócio (23)
        'Grupo', 'Principio_Ativo', 'MG', 'Custo', 'Demanda_Rede',
        'Ultima_Venda', 'Ultima_Entrada', 'Qtd_A_Vencer', 'Qtd_Perdida_Ano',
        'Tendencia_Perda', 'Prazo_Validade_Meses', 'Qtd_Vendida_Maior_Filial',
        'Filial_Maior_Venda', 'Vendas_PA_Filial', 'Vendas_PA_Rede',
        'Valor_Estoque_Custo', 'Valor_Excesso_Custo',
        'Score_Auditoria_Base', 'Score_Auditoria', 'Classificacao_Risco_Auditoria',
        'Risco_Demanda_Venda', 'Acao_Recomendada', 'Produto_Referencia_PA',
        # Contribuições explicáveis (10)
        'Contrib_meses_desde_ultima_venda',
        'Contrib_estoque_sobre_demanda_log',
        'Contrib_proporcao_a_vencer',
        'Contrib_proporcao_perda',
        'Contrib_custo_total_estoque',
        'Contrib_TENDENCIA_NUM',
        'Contrib_venda_max_log',
        'Contrib_demanda_rede_log',
        'Contrib_dias_desde_ultima_entrada',
        'Contrib_Categoria'
    ]

    cols_faltantes = [c for c in colunas_esperadas if c not in df_ind.columns]
    if cols_faltantes:
        erros.append(f"Colunas ausentes ({len(cols_faltantes)}): {cols_faltantes}")
        print(f"  ❌ {erros[-1]}")
    else:
        print(f"  ✅ Todas as {len(colunas_esperadas)} colunas obrigatórias estão presentes.")

    # Chave única
    duplicados = df_ind.duplicated(subset=['Filial', 'Codigo_Produto']).sum()
    if duplicados == 0:
        print(f"  ✅ Chave (Filial, Codigo_Produto) é única: 0 duplicatas.")
    else:
        erros.append(f"Encontradas {duplicados:,} duplicatas de (Filial, Codigo_Produto).")
        print(f"  ❌ {erros[-1]}")

    if p_est.exists():
        df_est = pd.read_csv(p_est)
        if len(df_est) == n_total:
            print(f"  ✅ Contagem de linhas idêntica a fEstoqueDemanda ({n_total:,} linhas).")
        else:
            erros.append(f"Tamanho divergente de fEstoqueDemanda: {n_total:,} vs {len(df_est):,}.")
            print(f"  ❌ {erros[-1]}")

    # -------------------------------------------------------------
    # 2. Consistência do Score de Auditoria e Contribuições
    # -------------------------------------------------------------
    print("\n--- [2] Consistência do Score de Auditoria e Soma de Contribuições ---")
    mask_com_estoque = df_ind['Estoque_Atual'] > 0
    mask_sem_estoque = df_ind['Estoque_Atual'] == 0

    # Linhas sem estoque devem ter Score_Auditoria NaN
    score_sem_est_notna = df_ind.loc[mask_sem_estoque, 'Score_Auditoria'].notna().sum()
    if score_sem_est_notna == 0:
        print(f"  ✅ 100% das linhas com Estoque=0 têm Score_Auditoria NaN ({mask_sem_estoque.sum():,} linhas).")
    else:
        erros.append(f"{score_sem_est_notna:,} linhas com Estoque=0 possuem Score_Auditoria não-nulo.")
        print(f"  ❌ {erros[-1]}")

    # Linhas com estoque devem ter Score no intervalo [0.0; 1.10]
    df_com_score = df_ind[mask_com_estoque].copy()
    scores_fora_faixa = ((df_com_score['Score_Auditoria'] < 0.0) | (df_com_score['Score_Auditoria'] > 1.10)).sum()
    if scores_fora_faixa == 0:
        print(f"  ✅ 100% dos scores com estoque estão no intervalo [0.0; 1.10].")
    else:
        erros.append(f"{scores_fora_faixa:,} linhas possuem Score_Auditoria fora do intervalo [0.0; 1.10].")
        print(f"  ❌ {erros[-1]}")

    # Soma de Contrib_* == Score_Auditoria (±0.001)
    contrib_cols = [c for c in df_ind.columns if c.startswith('Contrib_')]
    soma_contribs = np.round(df_com_score[contrib_cols].sum(axis=1), 4)
    dif_soma = np.abs(soma_contribs - df_com_score['Score_Auditoria'])
    inconsistencias_soma = (dif_soma > 0.001).sum()

    if inconsistencias_soma == 0:
        print(f"  ✅ 100% das linhas com score ({len(df_com_score):,}) satisfazem soma(Contrib_*) == Score_Auditoria (±0.001).")
    else:
        max_dif = dif_soma.max()
        erros.append(f"{inconsistencias_soma:,} linhas falharam na igualdade da soma de contribuições (diferença máx: {max_dif:.4f}).")
        print(f"  ❌ {erros[-1]}")

    # -------------------------------------------------------------
    # 3. Metas de Distribuição (§3.6)
    # -------------------------------------------------------------
    print("\n--- [3] Validação das Metas de Distribuição (§3.6) ---")

    # A. Classificação de Risco de Auditoria
    # Alto Risco: 3–12% | Médio-Alto: 5–15% | Baixo Risco: >= 50%
    pct_alto = (df_ind['Classificacao_Risco_Auditoria'] == 'Alto Risco').mean() * 100
    pct_medio_alto = (df_ind['Classificacao_Risco_Auditoria'] == 'Médio-Alto Risco').mean() * 100
    pct_baixo = (df_ind['Classificacao_Risco_Auditoria'] == 'Baixo Risco').mean() * 100

    print(f"  • Classificação Risco Auditoria:")
    print(f"    - Alto Risco:       {pct_alto:.2f}% (meta: 3.0% – 12.0%)")
    print(f"    - Médio-Alto Risco: {pct_medio_alto:.2f}% (meta: 5.0% – 15.0%)")
    print(f"    - Baixo Risco:      {pct_baixo:.2f}% (meta: >= 50.0%)")

    if not (3.0 <= pct_alto <= 12.0):
        erros.append(f"Alto Risco fora da meta: {pct_alto:.2f}% (esperado [3.0%; 12.0%])")
        print(f"    ❌ {erros[-1]}")
    else:
        print("    ✅ Alto Risco dentro da meta.")

    if not (5.0 <= pct_medio_alto <= 15.0):
        erros.append(f"Médio-Alto Risco fora da meta: {pct_medio_alto:.2f}% (esperado [5.0%; 15.0%])")
        print(f"    ❌ {erros[-1]}")
    else:
        print("    ✅ Médio-Alto Risco dentro da meta.")

    if pct_baixo < 50.0:
        erros.append(f"Baixo Risco abaixo da meta: {pct_baixo:.2f}% (esperado >= 50.0%)")
        print(f"    ❌ {erros[-1]}")
    else:
        print("    ✅ Baixo Risco dentro da meta.")

    # B. Status_Ruptura
    # Ruptura Consumada: 1–2.5% | Crítico/Alto Risco: 2–6%
    pct_rupt_cons = (df_ind['Status_Ruptura'] == 'Ruptura Consumada').mean() * 100
    pct_rupt_crit = (df_ind['Status_Ruptura'] == 'Crítico / Alto Risco').mean() * 100

    print(f"  • Status Ruptura:")
    print(f"    - Ruptura Consumada:   {pct_rupt_cons:.2f}% (meta: 1.0% – 2.5%)")
    print(f"    - Crítico / Alto Risco: {pct_rupt_crit:.2f}% (meta: 2.0% – 6.0%)")

    if not (1.0 <= pct_rupt_cons <= 2.5):
        erros.append(f"Ruptura Consumada fora da meta: {pct_rupt_cons:.2f}% (esperado [1.0%; 2.5%])")
        print(f"    ❌ {erros[-1]}")
    else:
        print("    ✅ Ruptura Consumada dentro da meta.")

    if not (2.0 <= pct_rupt_crit <= 6.0):
        erros.append(f"Crítico / Alto Risco fora da meta: {pct_rupt_crit:.2f}% (esperado [2.0%; 6.0%])")
        print(f"    ❌ {erros[-1]}")
    else:
        print("    ✅ Crítico / Alto Risco dentro da meta.")

    # C. Nível de Excesso
    # Elevado + Crítico: 10–25%
    mask_excesso = df_ind['Nivel_Excesso'].isin(['Excesso Elevado', 'Excesso Crítico'])
    pct_excesso = mask_excesso.mean() * 100
    print(f"  • Nível de Excesso (Elevado + Crítico): {pct_excesso:.2f}% (meta: 10.0% – 25.0%)")

    if not (10.0 <= pct_excesso <= 25.0):
        erros.append(f"Nível de Excesso fora da meta: {pct_excesso:.2f}% (esperado [10.0%; 25.0%])")
        print(f"    ❌ {erros[-1]}")
    else:
        print("    ✅ Nível de Excesso dentro da meta.")

    # D. Categoria de Risco de Perda (ML)
    # Crítico + Alto: 3–15%
    mask_perda_risco = df_ind['Categoria_Risco_Perda'].isin(['Crítico', 'Alto'])
    pct_perda_risco = mask_perda_risco.mean() * 100
    print(f"  • Categoria Risco Perda ML (Crítico + Alto): {pct_perda_risco:.2f}% (meta: 3.0% – 15.0%)")

    if not (3.0 <= pct_perda_risco <= 15.0):
        erros.append(f"Categoria Risco Perda ML fora da meta: {pct_perda_risco:.2f}% (esperado [3.0%; 15.0%])")
        print(f"    ❌ {erros[-1]}")
    else:
        print("    ✅ Categoria Risco Perda ML dentro da meta.")

    # E. Ação Recomendada
    # >= 30% das linhas com ação recomendada válida
    mask_acao_valida = df_ind['Acao_Recomendada'].notna() & \
                       (df_ind['Acao_Recomendada'] != '') & \
                       (df_ind['Acao_Recomendada'] != 'Nenhuma')
    pct_com_acao = mask_acao_valida.mean() * 100
    print(f"  • Ação Recomendada: {pct_com_acao:.2f}% (meta: >= 30.0%)")

    if pct_com_acao < 30.0:
        erros.append(f"Ação Recomendada abaixo da meta: {pct_com_acao:.2f}% (esperado >= 30.0%)")
        print(f"    ❌ {erros[-1]}")
    else:
        print("    ✅ Ação Recomendada dentro da meta.")

    print("\n" + "=" * 60)
    if erros:
        print(f"RESULTADO: ❌ FALHA ({len(erros)} erros encontrados)")
        for e in erros:
            print(f" - {e}")
        print("=" * 60)
        return False
    else:
        print("RESULTADO: ✅ SUCESSO! Todos os critérios de aceite e distribuições da Fase 2 foram validados com êxito.")
        print("=" * 60)
        return True


def main():
    parser = argparse.ArgumentParser(description="Validador de Invariantes do Pipeline de Prevenção de Perdas")
    parser.add_argument("--fase", type=int, required=True, choices=[1, 2], help="Número da fase a validar (1 ou 2)")
    parser.add_argument("--data-dir", type=str, default=str(DIR_CONSOLIDADOS), help="Diretório dos CSVs consolidados")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)

    if args.fase == 1:
        ok = validar_fase_1(data_dir)
        sys.exit(0 if ok else 1)
    elif args.fase == 2:
        ok = validar_fase_2(data_dir)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
