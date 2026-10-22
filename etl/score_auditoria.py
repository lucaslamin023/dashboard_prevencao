import os
import sys
from pathlib import Path
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.config import (
    DIR_CONSOLIDADOS,
    DATA_REFERENCIA,
    PESOS,
    PESO_CATEGORIA,
    LIMIAR_TENDENCIA,
    BONUS_CATEGORIA_PESO,
)
from etl.regras_acao import aplicar_regras_acao


def calcular_tendencia_perdas(df_perdas: pd.DataFrame, dt_ref: pd.Timestamp) -> pd.Series:
    """
    Passo T (§3.3): Coeficiente angular da regressão linear de perdas na janela de 365 dias por produto.
    x = dias desde o menor MES do produto; y = Quantidade.
    slope = cov/var. Zerar se |slope| < 0.05.
    """
    dt_inicio = dt_ref - pd.DateOffset(days=365)
    df_p = df_perdas.copy()
    df_p['Emissao_DT'] = pd.to_datetime(df_p['Emissao_Data'])

    mask_janela = (df_p['Emissao_DT'] >= dt_inicio) & (df_p['Emissao_DT'] <= dt_ref)
    df_janela = df_p[mask_janela].copy()

    if df_janela.empty:
        return pd.Series(dtype=float)

    df_janela['MES'] = df_janela['Emissao_DT'].dt.to_period('M').dt.to_timestamp()

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

    slopes = df_janela.groupby('Codigo_Produto').apply(calc_slope, include_groups=False)
    slopes.name = 'Slope_Produto'
    return slopes


def normalizar_min_max_grupo(df: pd.DataFrame, col: str, ignorar_zero: bool = False) -> np.ndarray:
    """
    Normaliza cada feature por min-max dentro de (Filial, Categoria) (§3.3 item 1).
    max == min -> 0.
    ignorar_zero=True (para TENDENCIA_NUM [D2]): min-max apenas entre valores != 0, zeros permanecem 0.
    """
    if ignorar_zero:
        res = np.zeros(len(df), dtype=float)
        mask_nz = (df[col] != 0.0) & df[col].notna()
        if not mask_nz.any():
            return res

        df_nz = df[mask_nz]
        g_nz = df_nz.groupby(['Filial', 'Categoria'])[col]
        min_nz = g_nz.transform('min').values
        max_nz = g_nz.transform('max').values
        diff_nz = max_nz - min_nz

        vals_nz = df_nz[col].values
        diff_safe = np.where(diff_nz > 0, diff_nz, 1.0)
        norm_nz = np.where(diff_nz > 0, (vals_nz - min_nz) / diff_safe, 0.0)
        res[mask_nz] = norm_nz
        return res
    else:
        g = df.groupby(['Filial', 'Categoria'])[col]
        min_v = g.transform('min').values
        max_v = g.transform('max').values
        diff = max_v - min_v
        diff_safe = np.where(diff > 0, diff, 1.0)
        vals = df[col].fillna(0.0).values
        return np.where(diff > 0, (vals - min_v) / diff_safe, 0.0)


def calcular_score_auditoria(data_dir=DIR_CONSOLIDADOS, verbose=True) -> pd.DataFrame:
    """
    Calcula todas as features e o Score de Auditoria vetorizado conforme especificação (§3.2, §3.3).
    Escopo: Linhas com Estoque_Atual > 0.
    Linhas com Estoque_Atual == 0 recebem Score_Auditoria = NaN.
    """
    if verbose:
        print("=== CALCULANDO SCORE DE AUDITORIA (VETORIZADO) ===")

    dt_ref = pd.to_datetime(DATA_REFERENCIA)

    df_est = pd.read_csv(data_dir / 'fEstoqueDemanda.csv')
    df_prod = pd.read_csv(data_dir / 'dProdutos.csv', dtype={'MG': str})
    df_mov = pd.read_csv(data_dir / 'fMovimentacao.csv')
    df_av = pd.read_csv(data_dir / 'fAVencer.csv')
    df_perdas = pd.read_csv(data_dir / 'fPerdasTotais.csv')

    # Base principal: fEstoqueDemanda + metadados de produto
    df = df_est.merge(
        df_prod[['Codigo_Produto', 'Nome_Produto', 'Categoria', 'Principio_Ativo', 'Grupo', 'MG', 'Custo_Referencia']],
        on='Codigo_Produto',
        how='left'
    )
    df = df.rename(columns={'Custo_Referencia': 'Custo'})

    # 1. Movimentação (Ultima_Venda, Ultima_Entrada)
    df = df.merge(df_mov[['Filial', 'Codigo_Produto', 'Ultima_Venda', 'Ultima_Entrada']], on=['Filial', 'Codigo_Produto'], how='left')

    # 2. fAVencer agregada (total_a_vencer com Resolvido='NÃO' limitado ao estoque, e menor vencimento)
    df_av_nao = df_av[df_av['Resolvido'] == 'NÃO'].copy()
    df_av_nao['Venc_DT'] = pd.to_datetime(df_av_nao['Vencimento'])

    av_agg = df_av_nao.groupby(['Filial', 'Codigo_Produto']).agg(
        Qtd_A_Vencer=('Estoque', 'sum'),
        Menor_Vencimento=('Venc_DT', 'min')
    ).reset_index()

    df = df.merge(av_agg, on=['Filial', 'Codigo_Produto'], how='left')
    df['Qtd_A_Vencer'] = df['Qtd_A_Vencer'].fillna(0).astype(int)

    # total_a_vencer limitado a Estoque_Atual
    total_a_vencer_limitado = np.minimum(df['Estoque_Atual'], df['Qtd_A_Vencer'])

    # Prazo de validade em meses do menor lote não resolvido: (ano_venc - ano_REF)*12 + (mes_venc - mes_REF)
    tem_venc = df['Menor_Vencimento'].notna()
    prazo_meses = np.full(len(df), np.nan)
    venc_dt = pd.to_datetime(df.loc[tem_venc, 'Menor_Vencimento'])
    prazo_meses[tem_venc] = (venc_dt.dt.year - dt_ref.year) * 12 + (venc_dt.dt.month - dt_ref.month)
    df['Prazo_Validade_Meses'] = prazo_meses

    # 3. fPerdasTotais agregada (qtd_perdida_ano na janela de 365d e Tendencia_Perda)
    dt_inicio_perdas = dt_ref - pd.DateOffset(days=365)
    df_perdas_dt = df_perdas.copy()
    df_perdas_dt['Emissao_DT'] = pd.to_datetime(df_perdas_dt['Emissao_Data'])

    mask_jan_perdas = (df_perdas_dt['Emissao_DT'] >= dt_inicio_perdas) & (df_perdas_dt['Emissao_DT'] <= dt_ref)
    perdas_janela = df_perdas_dt[mask_jan_perdas]

    perdas_ano_agg = perdas_janela.groupby(['Filial', 'Codigo_Produto'])['Quantidade'].sum().reset_index()
    perdas_ano_agg = perdas_ano_agg.rename(columns={'Quantidade': 'Qtd_Perdida_Ano'})
    df = df.merge(perdas_ano_agg, on=['Filial', 'Codigo_Produto'], how='left')
    df['Qtd_Perdida_Ano'] = df['Qtd_Perdida_Ano'].fillna(0).astype(int)

    # Tendência de perdas
    if verbose:
        print("  - Calculando tendência de perdas (Passo T)...")
    slopes_prod = calcular_tendencia_perdas(df_perdas, dt_ref)
    df = df.merge(slopes_prod, on='Codigo_Produto', how='left')
    df['Slope_Produto'] = df['Slope_Produto'].fillna(0.0)

    # Tendencia_Perda do par = slope do produto se o par tiver perdas na base histórica, senão 0
    pares_com_perdas_hist = set(zip(df_perdas['Filial'], df_perdas['Codigo_Produto']))
    par_tuplas = list(zip(df['Filial'], df['Codigo_Produto']))
    tem_perda_par = np.array([p in pares_com_perdas_hist for p in par_tuplas])
    df['Tendencia_Perda'] = np.where(tem_perda_par, df['Slope_Produto'], 0.0)

    # 4. Agregações de Rede e Princípio Ativo
    if verbose:
        print("  - Agregando vendas por Princípio Ativo e Filial com maior venda...")
    # qtd_vendida_maior_filial e Filial_Maior_Venda por produto
    est_sorted = df_est.sort_values(by=['Codigo_Produto', 'Demanda_Atual', 'Filial'], ascending=[True, False, True])
    top_filial_prod = est_sorted.drop_duplicates(subset=['Codigo_Produto'], keep='first')[
        ['Codigo_Produto', 'Demanda_Atual', 'Filial']
    ].rename(columns={'Demanda_Atual': 'Qtd_Vendida_Maior_Filial', 'Filial': 'Filial_Maior_Venda'})

    df = df.merge(top_filial_prod, on='Codigo_Produto', how='left')

    # Vendas Princípio Ativo (Filial / Rede)
    df['Principio_Ativo_Key'] = df['Principio_Ativo'].fillna('') + '___' + df['MG'].fillna('')

    pa_filial = df.groupby(['Filial', 'Principio_Ativo_Key'])['Demanda_Atual'].transform('sum')
    pa_rede = df.groupby('Principio_Ativo_Key')['Demanda_Atual'].transform('sum')
    df['Vendas_PA_Filial'] = pa_filial
    df['Vendas_PA_Rede'] = pa_rede

    # Produto Referência PA (somente para Grupo que começa com 'A')
    # "(código) nome" do produto de maior Demanda_Atual no mesmo (Filial, Principio_Ativo, MG)
    df_pharma = df[df['Grupo'].str.startswith('A', na=False)].sort_values(
        by=['Filial', 'Principio_Ativo_Key', 'Demanda_Atual', 'Codigo_Produto'],
        ascending=[True, True, False, True]
    )
    top_pa_prod = df_pharma.drop_duplicates(subset=['Filial', 'Principio_Ativo_Key'], keep='first').copy()
    top_pa_prod['Produto_Referencia_PA'] = "(" + top_pa_prod['Codigo_Produto'].astype(str) + ") " + top_pa_prod['Nome_Produto'].astype(str)

    df = df.merge(
        top_pa_prod[['Filial', 'Principio_Ativo_Key', 'Produto_Referencia_PA']],
        on=['Filial', 'Principio_Ativo_Key'],
        how='left'
    )
    # Z0Z0 e cosméticos recebem None
    df.loc[~df['Grupo'].str.startswith('A', na=False), 'Produto_Referencia_PA'] = None

    # Limpeza de coluna auxiliar
    df = df.drop(columns=['Principio_Ativo_Key', 'Menor_Vencimento', 'Slope_Produto'])

    # =========================================================================
    # CÁLCULO DAS 9 FEATURES NUMÉRICAS (Apenas linhas com Estoque_Atual > 0)
    # =========================================================================
    if verbose:
        print("  - Construindo matriz de features...")
    mask_estoque_pos = df['Estoque_Atual'] > 0

    uv_dt = pd.to_datetime(df['Ultima_Venda'])
    ue_dt = pd.to_datetime(df['Ultima_Entrada'])

    # meses_desde_ultima_venda: (REF - Ultima_Venda).dias/30, ou 36 se nunca vendeu; clip(max=12)
    dias_uv = (dt_ref - uv_dt).dt.days
    df['dias_desde_ultima_venda'] = np.where(uv_dt.notna(), dias_uv, 365.0)

    meses_uv = np.where(uv_dt.notna(), dias_uv / 30.0, 36.0)
    meses_uv = np.clip(meses_uv, 0.0, 12.0)

    # meses_desde_ultima_entrada: (REF - Ultima_Entrada).dias/30, ou 36 se nunca entrou; clip(max=12)
    dias_ue = (dt_ref - ue_dt).dt.days
    meses_ue = np.where(ue_dt.notna(), dias_ue / 30.0, 36.0)
    meses_ue = np.clip(meses_ue, 0.0, 12.0)

    # se meses_desde_ultima_entrada < 4: meses_desde_ultima_venda = 1
    meses_uv = np.where(meses_ue < 4.0, 1.0, meses_uv)
    df['meses_desde_ultima_venda'] = meses_uv

    # dias_desde_ultima_entrada: (REF - Ultima_Entrada).dias; nulo/nunca -> 365; clip(max=365) [D5]
    dias_ue_clip = np.where(ue_dt.notna(), dias_ue, 365.0)
    df['dias_desde_ultima_entrada'] = np.clip(dias_ue_clip, 0.0, 365.0)

    # proporcao_a_vencer = total_a_vencer / Estoque_Atual
    df['proporcao_a_vencer'] = np.where(mask_estoque_pos, total_a_vencer_limitado / df['Estoque_Atual'], 0.0)

    # proporcao_perda = qtd_perdida_ano / Estoque_Atual
    df['proporcao_perda'] = np.where(mask_estoque_pos, df['Qtd_Perdida_Ano'] / df['Estoque_Atual'], 0.0)

    # estoque_sobre_demanda_log = log1p(Estoque_Atual / (Demanda_Atual se != 0 senao 1))
    dem_div = np.where(df['Demanda_Atual'] != 0, df['Demanda_Atual'], 1.0)
    df['estoque_sobre_demanda_log'] = np.log1p(df['Estoque_Atual'] / dem_div)

    # venda_max_log = log1p(qtd_vendida_maior_filial / Estoque_Atual)
    df['venda_max_log'] = np.where(mask_estoque_pos, np.log1p(df['Qtd_Vendida_Maior_Filial'] / df['Estoque_Atual']), 0.0)

    # demanda_rede_log = log1p(Demanda_Rede / Estoque_Atual)
    df['demanda_rede_log'] = np.where(mask_estoque_pos, np.log1p(df['Demanda_Rede'] / df['Estoque_Atual']), 0.0)

    # custo_total_estoque = Estoque_Atual * custo
    df['custo_total_estoque'] = df['Estoque_Atual'] * df['Custo']

    # TENDENCIA_NUM
    df['TENDENCIA_NUM'] = df['Tendencia_Perda']

    # =========================================================================
    # NORMALIZAÇÃO MIN-MAX POR (Filial, Categoria) E CÁLCULO DO SCORE
    # =========================================================================
    if verbose:
        print("  - Normalizando features por (Filial, Categoria)...")
    score_base = np.zeros(len(df), dtype=float)

    feature_col_names = [
        'meses_desde_ultima_venda',
        'estoque_sobre_demanda_log',
        'proporcao_a_vencer',
        'proporcao_perda',
        'custo_total_estoque',
        'TENDENCIA_NUM',
        'venda_max_log',
        'demanda_rede_log',
        'dias_desde_ultima_entrada',
    ]

    for feat in feature_col_names:
        peso = PESOS[feat]
        ignorar_zero = (feat == 'TENDENCIA_NUM')
        norm_v = normalizar_min_max_grupo(df, feat, ignorar_zero=ignorar_zero)
        contrib_v = np.round(norm_v * peso, 4)

        # Salvar contribuição por feature
        df[f'Contrib_{feat}'] = np.where(mask_estoque_pos, contrib_v, np.nan)
        score_base += np.where(mask_estoque_pos, contrib_v, 0.0)

    score_base = np.round(score_base, 4)

    # Se nunca vendeu e Score_Base == 0 -> 0.4 (§3.3 item 2)
    nunca_vendeu = df['Ultima_Venda'].isna()
    ajuste_04 = mask_estoque_pos & nunca_vendeu & (score_base == 0.0)
    if ajuste_04.any():
        score_base = np.where(ajuste_04, 0.40, score_base)
        df.loc[ajuste_04, 'Contrib_meses_desde_ultima_venda'] = 0.40

    df['Score_Auditoria_Base'] = np.where(mask_estoque_pos, score_base, np.nan)

    # 3. Classificação de Risco sobre Score_Base
    cond_classes = [
        score_base < 0.10,
        score_base < 0.20,
        score_base < 0.30,
    ]
    escolhas_classes = [
        'Baixo Risco',
        'Médio Risco',
        'Médio-Alto Risco',
    ]
    classificacao = np.select(cond_classes, escolhas_classes, default='Alto Risco')
    df['Classificacao_Risco_Auditoria'] = np.where(mask_estoque_pos, classificacao, None)

    # 4. Bônus de categoria
    # peso_categoria_norm = min-max global de PESO_CATEGORIA[Categoria]
    pesos_cat_series = df['Categoria'].map(PESO_CATEGORIA).fillna(2).astype(float)
    min_peso_cat = min(PESO_CATEGORIA.values())
    max_peso_cat = max(PESO_CATEGORIA.values())
    peso_categoria_norm = (pesos_cat_series - min_peso_cat) / (max_peso_cat - min_peso_cat)

    elegivel_bonus = mask_estoque_pos & df['Classificacao_Risco_Auditoria'].isin(['Médio-Alto Risco', 'Alto Risco'])
    contrib_categoria = np.where(elegivel_bonus, np.round(BONUS_CATEGORIA_PESO * peso_categoria_norm, 4), 0.0)

    df['Contrib_Categoria'] = np.where(mask_estoque_pos, contrib_categoria, np.nan)
    score_final = np.round(score_base + contrib_categoria, 4)
    df['Score_Auditoria'] = np.where(mask_estoque_pos, score_final, np.nan)

    # 5. Risco_Demanda_Venda (usa Score_Auditoria)
    if verbose:
        print("  - Avaliando Risco_Demanda_Venda e Ações Recomendadas...")
    dem_rede_div = np.where(df['Demanda_Rede'] > 0, df['Demanda_Rede'], 1.0)
    est_dem_rede = df['Estoque_Atual'] / dem_rede_div
    prop_top = df['Qtd_Vendida_Maior_Filial'] / dem_rede_div

    cond_rdv = [
        (score_final >= 0.25) & (est_dem_rede > 6.0) & (prop_top < 0.4),
        (score_final >= 0.25) & (est_dem_rede > 6.0),
        (score_final >= 0.20) & (est_dem_rede > 4.0),
    ]
    escolhas_rdv = [
        'Altíssimo Risco',
        'Alto Risco',
        'Moderado',
    ]
    rdv = np.select(cond_rdv, escolhas_rdv, default='Baixo')
    df['Risco_Demanda_Venda'] = np.where(mask_estoque_pos, rdv, None)

    # 6. Ação Recomendada (§3.4)
    df['Acao_Recomendada'] = aplicar_regras_acao(df)

    # Remover colunas internas temporárias de cálculo
    colunas_temp = [
        'meses_desde_ultima_venda', 'dias_desde_ultima_venda', 'dias_desde_ultima_entrada',
        'proporcao_a_vencer', 'proporcao_perda', 'estoque_sobre_demanda_log',
        'venda_max_log', 'demanda_rede_log', 'custo_total_estoque', 'TENDENCIA_NUM'
    ]
    df = df.drop(columns=colunas_temp)

    if verbose:
        print("✓ Score de Auditoria concluído.")
    return df
