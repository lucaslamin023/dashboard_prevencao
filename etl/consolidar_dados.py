import os
import re
import sys
import random
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
    DIR_ANONIMIZADOS,
    DIR_CONSOLIDADOS,
    SEED,
    DATA_REFERENCIA,
    TOTAL_FILIAIS,
)


def set_seed(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)


def consolidar_dados():
    set_seed(SEED)
    print("=" * 65)
    print("🚀 INICIANDO CONSOLIDAÇÃO DA BASE ANONIMIZADA (FASE 1)")
    print(f"Diretório Origem : {DIR_ANONIMIZADOS}")
    print(f"Diretório Destino: {DIR_CONSOLIDADOS}")
    print(f"Data Referência  : {DATA_REFERENCIA}")
    print(f"Seed             : {SEED}")
    print("=" * 65)

    os.makedirs(DIR_CONSOLIDADOS, exist_ok=True)
    dt_ref = pd.to_datetime(DATA_REFERENCIA)

    # =========================================================================
    # 1. dProdutos (adicionar Grupo e MG)
    # =========================================================================
    print("\n[1/12] Processando dProdutos...")
    df_prod = pd.read_csv(DIR_ANONIMIZADOS / "dProdutos.csv")
    n_prods = len(df_prod)

    # Grupo:
    # Principio_Ativo != 'N/A (Cosmético)' -> A1A1 (30%), A1A2 (25%), A2A2 (20%), A1C1 (15%), A1D2 (10%)
    # Demais -> Z0Z0
    is_pharma = df_prod['Principio_Ativo'] != 'N/A (Cosmético)'
    grupos_pharma_pool = ['A1A1', 'A1A2', 'A2A2', 'A1C1', 'A1D2']
    prob_grupos = [0.30, 0.25, 0.20, 0.15, 0.10]

    grupos_atrib = np.full(n_prods, 'Z0Z0', dtype=object)
    grupos_atrib[is_pharma] = np.random.choice(grupos_pharma_pool, p=prob_grupos, size=is_pharma.sum())
    df_prod['Grupo'] = grupos_atrib

    # MG:
    # regex: (\d+[.,]?\d*(?:/\d+[.,]?\d*)*)\s*(?:mg|mcg|g)\b
    # somente se Grupo começa com 'A', senão ""
    mg_regex = re.compile(r'(\d+[.,]?\d*(?:/\d+[.,]?\d*)*)\s*(?:mg|mcg|g)\b', re.IGNORECASE)

    def extrair_mg(row):
        grupo = row['Grupo']
        if not grupo.startswith('A'):
            return ""
        nome = str(row['Nome_Produto'])
        m = mg_regex.search(nome)
        if m:
            return m.group(1).replace(',', '.')
        return ""

    df_prod['MG'] = df_prod.apply(extrair_mg, axis=1)

    df_prod.to_csv(DIR_CONSOLIDADOS / "dProdutos.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ dProdutos consolidado: {len(df_prod):,} linhas.")

    # =========================================================================
    # 2. dFilial (manter 232 filiais)
    # =========================================================================
    print("\n[2/12] Processando dFilial...")
    df_filial = pd.read_csv(DIR_ANONIMIZADOS / "dFilial.csv")
    df_filial.to_csv(DIR_CONSOLIDADOS / "dFilial.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ dFilial consolidado: {len(df_filial):,} linhas.")

    # =========================================================================
    # 3. dCalendario (truncar em DATA_REFERENCIA)
    # =========================================================================
    print("\n[3/12] Processando dCalendario...")
    df_cal = pd.read_csv(DIR_ANONIMIZADOS / "dCalendario.csv")
    df_cal_trunc = df_cal[df_cal['Data'] <= DATA_REFERENCIA].copy()
    df_cal_trunc.to_csv(DIR_CONSOLIDADOS / "dCalendario.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ dCalendario consolidado: {len(df_cal_trunc):,} linhas (truncado em {DATA_REFERENCIA}).")

    # =========================================================================
    # 4. dVendedores (manter)
    # =========================================================================
    print("\n[4/12] Processando dVendedores...")
    df_vend = pd.read_csv(DIR_ANONIMIZADOS / "dVendedores.csv")
    df_vend.to_csv(DIR_CONSOLIDADOS / "dVendedores.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ dVendedores consolidado: {len(df_vend):,} linhas.")

    # =========================================================================
    # 5. fEstoqueDemanda & Universo
    # =========================================================================
    print("\n[5/12] Processando fEstoqueDemanda e Universo (Filial, Codigo_Produto)...")
    df_est_raw = pd.read_csv(DIR_ANONIMIZADOS / "fEstoqueDemanda.csv")

    # Deduplicação somando Estoque_Atual, Demanda_Atual, Demanda_Ponderada
    print("  - Deduplicando pares existentes...")
    df_est_dedup = df_est_raw.groupby(['Filial', 'Codigo_Produto'], as_index=False).agg({
        'Estoque_Atual': 'sum',
        'Demanda_Atual': 'sum',
        'Demanda_Ponderada': 'sum'
    })
    print(f"    Originais: {len(df_est_raw):,} -> Deduplicados: {len(df_est_dedup):,}")

    # Completar filiais ausentes (1..232)
    filiais_existentes = set(df_est_dedup['Filial'].unique())
    filiais_todas = set(range(1, TOTAL_FILIAIS + 1))
    filiais_ausentes = sorted(filiais_todas - filiais_existentes)
    print(f"  - Completando {len(filiais_ausentes)} filiais ausentes (1..232)...")

    produtos_pool = df_prod['Codigo_Produto'].values
    novas_filiais_dfs = []

    # Amostragem bootstrap de valores existentes
    indices_bootstrap = np.random.choice(len(df_est_dedup), size=len(filiais_ausentes) * 2600, replace=True)
    boot_est = df_est_dedup['Estoque_Atual'].values[indices_bootstrap]
    boot_dem = df_est_dedup['Demanda_Atual'].values[indices_bootstrap]
    boot_pond = df_est_dedup['Demanda_Ponderada'].values[indices_bootstrap]

    curr_idx = 0
    for fid in filiais_ausentes:
        # 2600 produtos sorteados sem reposição para cada filial
        prods_sorteados = np.random.choice(produtos_pool, size=2600, replace=False)
        sub_est = boot_est[curr_idx:curr_idx + 2600]
        sub_dem = boot_dem[curr_idx:curr_idx + 2600]
        sub_pond = boot_pond[curr_idx:curr_idx + 2600]
        curr_idx += 2600

        df_fid = pd.DataFrame({
            'Filial': fid,
            'Codigo_Produto': prods_sorteados,
            'Estoque_Atual': sub_est,
            'Demanda_Atual': sub_dem,
            'Demanda_Ponderada': sub_pond
        })
        novas_filiais_dfs.append(df_fid)

    df_est_completo = pd.concat([df_est_dedup] + novas_filiais_dfs, ignore_index=True)
    n_universo = len(df_est_completo)
    print(f"    Total do universo expandido: {n_universo:,} pares.")

    # Ajustes de Demanda=0 (~20%) e Ruptura Consumada (~1.8%)
    print("  - Calibrando participações: ~20% Demanda=0 e ~1.8% Ruptura Consumada (Estoque=0)...")
    indices_shuffled = np.random.permutation(n_universo)

    # 1. 20.0% dos pares: Demanda_Atual = 0 e Demanda_Ponderada = U(0; 1.5)
    n_dem_zero = int(n_universo * 0.200)
    idx_dem_zero = indices_shuffled[:n_dem_zero]

    df_est_completo.loc[idx_dem_zero, 'Demanda_Atual'] = 0
    df_est_completo.loc[idx_dem_zero, 'Demanda_Ponderada'] = np.round(
        np.random.uniform(0.0, 1.5, size=n_dem_zero), 2
    )
    # Garante que esses pares com demanda zero tenham Estoque_Atual > 0
    est_zero_em_dem_zero = df_est_completo.loc[idx_dem_zero, 'Estoque_Atual'] <= 0
    if est_zero_em_dem_zero.any():
        df_est_completo.loc[idx_dem_zero[est_zero_em_dem_zero], 'Estoque_Atual'] = np.random.randint(
            1, 25, size=est_zero_em_dem_zero.sum()
        )

    # 2. 1.8% dos pares adicionais: Estoque_Atual = 0 e Demanda_Atual > 0 (Ruptura Consumada)
    n_est_zero = int(n_universo * 0.018)
    idx_est_zero = indices_shuffled[n_dem_zero:n_dem_zero + n_est_zero]

    df_est_completo.loc[idx_est_zero, 'Estoque_Atual'] = 0
    # Garante que Demanda_Atual > 0 para esses pares (Ruptura Consumada)
    dem_invalida = df_est_completo.loc[idx_est_zero, 'Demanda_Atual'] <= 0
    if dem_invalida.any():
        df_est_completo.loc[idx_est_zero[dem_invalida], 'Demanda_Atual'] = np.random.randint(
            1, 15, size=dem_invalida.sum()
        )
        df_est_completo.loc[idx_est_zero[dem_invalida], 'Demanda_Ponderada'] = np.round(
            df_est_completo.loc[idx_est_zero[dem_invalida], 'Demanda_Atual'] * np.random.uniform(0.8, 1.2), 2
        )

    # 3. Demais pares: garantir Estoque_Atual > 0 e Demanda_Atual > 0
    idx_restantes = indices_shuffled[n_dem_zero + n_est_zero:]
    est_restante_invalido = df_est_completo.loc[idx_restantes, 'Estoque_Atual'] <= 0
    if est_restante_invalido.any():
        df_est_completo.loc[idx_restantes[est_restante_invalido], 'Estoque_Atual'] = np.random.randint(
            1, 30, size=est_restante_invalido.sum()
        )
    dem_restante_invalida = df_est_completo.loc[idx_restantes, 'Demanda_Atual'] <= 0
    if dem_restante_invalida.any():
        df_est_completo.loc[idx_restantes[dem_restante_invalida], 'Demanda_Atual'] = np.random.randint(
            1, 20, size=dem_restante_invalida.sum()
        )

    # Recalcular Demanda_Rede = soma(Demanda_Atual) por produto
    print("  - Recalculando Demanda_Rede...")
    dem_rede_map = df_est_completo.groupby('Codigo_Produto')['Demanda_Atual'].sum()
    df_est_completo['Demanda_Rede'] = df_est_completo['Codigo_Produto'].map(dem_rede_map).astype(float)

    # Ordenação e tipos
    cols_est = ['Filial', 'Codigo_Produto', 'Demanda_Atual', 'Estoque_Atual', 'Demanda_Rede', 'Demanda_Ponderada']
    df_est_final = df_est_completo[cols_est].copy()
    df_est_final['Filial'] = df_est_final['Filial'].astype(int)
    df_est_final['Codigo_Produto'] = df_est_final['Codigo_Produto'].astype(int)
    df_est_final['Demanda_Atual'] = df_est_final['Demanda_Atual'].astype(int)
    df_est_final['Estoque_Atual'] = df_est_final['Estoque_Atual'].astype(int)
    df_est_final['Demanda_Ponderada'] = np.round(df_est_final['Demanda_Ponderada'], 2)

    df_est_final.to_csv(DIR_CONSOLIDADOS / "fEstoqueDemanda.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ fEstoqueDemanda consolidado: {len(df_est_final):,} linhas.")

    # Universo de pares e produtos para referência estrita
    pares_universo = df_est_final[['Filial', 'Codigo_Produto']].drop_duplicates()
    pares_com_estoque = df_est_final[df_est_final['Estoque_Atual'] > 0][
        ['Filial', 'Codigo_Produto', 'Estoque_Atual', 'Demanda_Atual']
    ].copy()

    # =========================================================================
    # 6. fAVencer
    # =========================================================================
    print("\n[6/12] Processando fAVencer...")
    df_av_raw = pd.read_csv(DIR_ANONIMIZADOS / "fAVencer.csv")
    n_av = len(df_av_raw)  # 75.730 linhas mantidas

    # Selecionar pares com estoque > 0.
    # Distribuir as 75.730 linhas entre ~65.000 pares únicos para permitir pares com múltiplos lotes
    # mantendo a soma do lote <= estoque do par.
    n_pares_av = 65000
    indices_pares_av = np.random.choice(len(pares_com_estoque), size=n_pares_av, replace=False)
    pares_selecionados = pares_com_estoque.iloc[indices_pares_av].copy()

    n_pares_2_lotes = n_av - n_pares_av  # 10.730 pares terão 2 lotes
    idx_2_lotes = pares_selecionados.index[:n_pares_2_lotes]
    idx_1_lote = pares_selecionados.index[n_pares_2_lotes:]

    pares_1 = pares_selecionados.loc[idx_1_lote].copy()
    pares_2a = pares_selecionados.loc[idx_2_lotes].copy()
    pares_2b = pares_selecionados.loc[idx_2_lotes].copy()

    # Cálculo dos lotes com soma <= Estoque_Atual
    # Lote 1 para pares de 1 lote:
    est_max_1 = np.maximum(1, np.floor(pares_1['Estoque_Atual'] * 0.7).astype(int))
    pares_1['Estoque_Lote'] = [random.randint(1, m) for m in est_max_1]

    # Lotes para pares de 2 lotes:
    est_max_2 = np.maximum(2, np.floor(pares_2a['Estoque_Atual'] * 0.7).astype(int))
    lotes_a = [random.randint(1, max(1, m // 2)) for m in est_max_2]
    lotes_b = [random.randint(1, max(1, m - la)) for m, la in zip(est_max_2, lotes_a)]
    pares_2a['Estoque_Lote'] = lotes_a
    pares_2b['Estoque_Lote'] = lotes_b

    df_av_construido = pd.concat([pares_1, pares_2a, pares_2b], ignore_index=True)
    df_av_construido = df_av_construido.sample(frac=1.0, random_state=SEED).reset_index(drop=True)

    # Merge metadados de produto (Comprador, Fornecedor, Custo_Referencia)
    df_av_construido = df_av_construido.merge(
        df_prod[['Codigo_Produto', 'Comprador', 'Fornecedor', 'Custo_Referencia']],
        on='Codigo_Produto',
        how='left'
    )

    df_av_construido['Custo_Unitario'] = df_av_construido['Custo_Referencia']
    df_av_construido['Estoque'] = df_av_construido['Estoque_Lote']
    df_av_construido['Total_AV'] = np.round(df_av_construido['Estoque'] * df_av_construido['Custo_Unitario'], 2)
    df_av_construido['Preco_Venda'] = np.round(
        df_av_construido['Custo_Unitario'] * np.random.uniform(1.3, 2.2, size=n_av), 2
    )

    # Resolvido: SIM 15% / NÃO 85%
    df_av_construido['Resolvido'] = np.random.choice(['SIM', 'NÃO'], p=[0.15, 0.85], size=n_av)

    # Vencimento: [REF-30d; REF+540d]
    # 10% recentes vencidos [-30, -1]
    # 40% 0–90d [0, 90]
    # 30% 90–240d [91, 240]
    # 20% 240–540d [241, 540]
    n_v1 = int(n_av * 0.10)
    n_v2 = int(n_av * 0.40)
    n_v3 = int(n_av * 0.30)
    n_v4 = n_av - (n_v1 + n_v2 + n_v3)

    offsets_venc = np.concatenate([
        np.random.randint(-30, 0, size=n_v1),
        np.random.randint(0, 91, size=n_v2),
        np.random.randint(91, 241, size=n_v3),
        np.random.randint(241, 541, size=n_v4),
    ])
    np.random.shuffle(offsets_venc)

    dates_venc = dt_ref + pd.to_timedelta(offsets_venc, unit='D')
    df_av_construido['Vencimento'] = dates_venc.strftime('%Y-%m-%d')

    df_av_construido['ZJ1_ID'] = np.arange(1, n_av + 1)
    df_av_construido['ZJ1_Lote'] = [f"LT-{random.randint(10000, 99999)}" for _ in range(n_av)]
    df_av_construido['EAN'] = [f"789{random.randint(1000000000, 9999999999)}" for _ in range(n_av)]
    df_av_construido['Demanda'] = np.maximum(1, df_av_construido['Demanda_Atual'])
    df_av_construido['Chave'] = df_av_construido['Filial'].astype(str) + '_' + df_av_construido['ZJ1_ID'].astype(str)

    cols_av = [
        'Filial', 'ZJ1_ID', 'Codigo_Produto', 'EAN', 'Vencimento', 'Resolvido',
        'ZJ1_Lote', 'Demanda', 'Estoque', 'Custo_Unitario', 'Total_AV',
        'Preco_Venda', 'Comprador', 'Fornecedor', 'Chave'
    ]
    df_av_final = df_av_construido[cols_av].copy()
    df_av_final.to_csv(DIR_CONSOLIDADOS / "fAVencer.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ fAVencer consolidado: {len(df_av_final):,} linhas.")

    # =========================================================================
    # 7. fVendas (250k linhas, 80/20 AV, [2023-01-01, REF])
    # =========================================================================
    print("\n[7/12] Processando fVendas...")
    n_vendas_total = 250000
    n_vendas_av = int(n_vendas_total * 0.20)      # 50.000 (20%)
    n_vendas_norm = n_vendas_total - n_vendas_av  # 200.000 (80%)

    start_date_vendas = pd.Timestamp('2023-01-01')
    dias_max_vendas = (dt_ref - start_date_vendas).days  # 1368 dias

    vendedores_pool = df_vend['ID_Vendedor'].values

    # Pares para vendas normais: proporcionais à Demanda_Atual (dentre pares com Demanda_Atual > 0)
    pares_com_demanda = df_est_final[df_est_final['Demanda_Atual'] > 0][
        ['Filial', 'Codigo_Produto', 'Demanda_Atual']
    ].copy()
    pesos_norm = pares_com_demanda['Demanda_Atual'].values.astype(float)
    pesos_norm /= pesos_norm.sum()

    idx_pares_norm = np.random.choice(len(pares_com_demanda), size=n_vendas_norm, p=pesos_norm)
    vendas_norm_pares = pares_com_demanda.iloc[idx_pares_norm].reset_index(drop=True)

    dias_sorteados_norm = np.random.randint(0, dias_max_vendas + 1, size=n_vendas_norm)
    dates_norm = (start_date_vendas + pd.to_timedelta(dias_sorteados_norm, unit='D')).strftime('%Y-%m-%d')
    qty_norm = np.random.randint(1, 5, size=n_vendas_norm)
    preco_norm = np.round(np.random.uniform(45.00, 180.00, size=n_vendas_norm), 2)
    total_norm = np.round(qty_norm * preco_norm, 2)

    df_vendas_norm = pd.DataFrame({
        'ID_Venda': [f"VND-NOR-{i:06d}" for i in range(1, n_vendas_norm + 1)],
        'Data_Venda': dates_norm,
        'Filial': vendas_norm_pares['Filial'].values,
        'ID_Vendedor': np.random.choice(vendedores_pool, size=n_vendas_norm),
        'Codigo_Produto': vendas_norm_pares['Codigo_Produto'].values,
        'Tipo_Venda': 'V',
        'Quantidade_Vendida': qty_norm,
        'Valor_Unitario': preco_norm,
        'Valor_Total': total_norm,
        'Is_Venda_AV': 0
    })

    # Pares para vendas AV: somente em pares com lote em fAVencer
    pares_av_unicos = df_av_final[['Filial', 'Codigo_Produto']].drop_duplicates().merge(
        df_est_final[['Filial', 'Codigo_Produto', 'Demanda_Atual']],
        on=['Filial', 'Codigo_Produto'],
        how='left'
    )
    pesos_av = (pares_av_unicos['Demanda_Atual'].values + 0.5).astype(float)
    pesos_av /= pesos_av.sum()

    idx_pares_av = np.random.choice(len(pares_av_unicos), size=n_vendas_av, p=pesos_av)
    vendas_av_pares = pares_av_unicos.iloc[idx_pares_av].reset_index(drop=True)

    dias_sorteados_av = np.random.randint(0, dias_max_vendas + 1, size=n_vendas_av)
    dates_av = (start_date_vendas + pd.to_timedelta(dias_sorteados_av, unit='D')).strftime('%Y-%m-%d')
    qty_av = np.random.randint(1, 4, size=n_vendas_av)
    preco_av = np.round(np.random.uniform(4.00, 18.00, size=n_vendas_av), 2)
    total_av = np.round(qty_av * preco_av, 2)

    df_vendas_av = pd.DataFrame({
        'ID_Venda': [f"VND-AV-{i:06d}" for i in range(1, n_vendas_av + 1)],
        'Data_Venda': dates_av,
        'Filial': vendas_av_pares['Filial'].values,
        'ID_Vendedor': np.random.choice(vendedores_pool, size=n_vendas_av),
        'Codigo_Produto': vendas_av_pares['Codigo_Produto'].values,
        'Tipo_Venda': 'V',
        'Quantidade_Vendida': qty_av,
        'Valor_Unitario': preco_av,
        'Valor_Total': total_av,
        'Is_Venda_AV': 1
    })

    df_vendas_final = pd.concat([df_vendas_norm, df_vendas_av], ignore_index=True)
    df_vendas_final = df_vendas_final.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
    df_vendas_final.to_csv(DIR_CONSOLIDADOS / "fVendas.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ fVendas consolidado: {len(df_vendas_final):,} linhas.")

    # =========================================================================
    # 8. fPerdasTotais (log-normal, ~30% produtos com tendência, calibrado I5/I6)
    # =========================================================================
    print("\n[8/12] Processando fPerdasTotais...")
    n_perdas_total = 140000

    # Concentrar perdas em ~25% dos pares do universo
    n_pares_perdas = int(len(pares_universo) * 0.25)
    pares_perdas_pool = pares_universo.sample(n=n_pares_perdas, random_state=SEED).reset_index(drop=True)

    # ~35% dos produtos presentes no pool de perdas aplicam tendência crescente
    produtos_distintos = pares_perdas_pool['Codigo_Produto'].unique()
    n_prod_tendencia = int(len(produtos_distintos) * 0.35)
    produtos_com_tendencia = set(np.random.choice(produtos_distintos, size=n_prod_tendencia, replace=False))

    # Amostragem de pares para as linhas de perda
    idx_perdas_pares = np.random.choice(len(pares_perdas_pool), size=n_perdas_total, replace=True)
    df_perdas_base = pares_perdas_pool.iloc[idx_perdas_pares].reset_index(drop=True)

    # Datas: [2023-01-01, REF]
    dias_sorteados_perdas = np.random.randint(0, dias_max_vendas + 1, size=n_perdas_total)
    datas_perdas_dt = start_date_vendas + pd.to_timedelta(dias_sorteados_perdas, unit='D')
    df_perdas_base['Emissao_Data'] = datas_perdas_dt.strftime('%Y-%m-%d')
    df_perdas_base['Emissao_DT'] = datas_perdas_dt

    # Quantidade: Log-normal inteira (média ~ 3, p95 ~ 15)
    amostras_lognorm = np.random.lognormal(mean=0.74, sigma=0.85, size=n_perdas_total)
    base_qty = np.clip(np.round(amostras_lognorm), 1, 30).astype(int)

    # Tendência crescente na janela de 365d para os produtos selecionados
    # Mês na janela [2025-10; 2026-09] -> valores de 0 a 11
    ano_mes_num = (datas_perdas_dt.year - 2025) * 12 + datas_perdas_dt.month - 10
    is_prod_tend = df_perdas_base['Codigo_Produto'].isin(produtos_com_tendencia)
    is_janela = ano_mes_num >= 0

    inc_tendencia = np.where(
        is_prod_tend & is_janela,
        (ano_mes_num * 2.8).astype(int),
        0
    )
    df_perdas_base['Quantidade'] = base_qty + inc_tendencia

    # Custo = Custo_Referencia * U(0.15; 0.35)
    df_perdas_base = df_perdas_base.merge(
        df_prod[['Codigo_Produto', 'Custo_Referencia']],
        on='Codigo_Produto',
        how='left'
    )
    custo_base = np.round(df_perdas_base['Custo_Referencia'] * np.random.uniform(0.15, 0.35, size=n_perdas_total), 2)
    df_perdas_base['Custo'] = custo_base
    df_perdas_base['Valor_Perda'] = np.round(df_perdas_base['Quantidade'] * df_perdas_base['Custo'], 2)

    # Calibrar mensalmente contra fVendas para assegurar I5 (Perdas/Faturamento <= 2.5% <= 3%)
    df_vendas_final['Mes'] = pd.to_datetime(df_vendas_final['Data_Venda']).dt.to_period('M')
    fat_mensal = df_vendas_final.groupby('Mes')['Valor_Total'].sum().to_dict()

    df_perdas_base['Mes'] = datas_perdas_dt.to_period('M')
    perda_mensal = df_perdas_base.groupby('Mes')['Valor_Perda'].sum().to_dict()

    # Ajuste por mês
    for mes, p_val in perda_mensal.items():
        f_val = fat_mensal.get(mes, 0)
        limite_teto = f_val * 0.024  # Teto de 2.4% para folga confortável em relação aos 3%
        if f_val > 0 and p_val > limite_teto:
            fator_ajuste = limite_teto / p_val
            mask_mes = df_perdas_base['Mes'] == mes
            df_perdas_base.loc[mask_mes, 'Custo'] = np.round(df_perdas_base.loc[mask_mes, 'Custo'] * fator_ajuste, 2)
            df_perdas_base.loc[mask_mes, 'Valor_Perda'] = np.round(
                df_perdas_base.loc[mask_mes, 'Quantidade'] * df_perdas_base.loc[mask_mes, 'Custo'], 2
            )

    motivos_pool = ['DANIFICADO', 'VENCIMENTO', 'AVARIA TRANSPORTE', 'QUEBRA INTERNA', 'DESCARTE SANITÁRIO']
    df_perdas_base['Motivo_Perda'] = [random.choice(motivos_pool) for _ in range(n_perdas_total)]

    cols_perdas = ['Emissao_Data', 'Filial', 'Codigo_Produto', 'Motivo_Perda', 'Quantidade', 'Custo', 'Valor_Perda']
    df_perdas_final = df_perdas_base[cols_perdas].copy()
    df_perdas_final.to_csv(DIR_CONSOLIDADOS / "fPerdasTotais.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ fPerdasTotais consolidado: {len(df_perdas_final):,} linhas.")

    # =========================================================================
    # 9. fMovimentacao (NOVA TABELA: Filial, Codigo_Produto, Ultima_Venda, Ultima_Entrada)
    # =========================================================================
    print("\n[9/12] Gerando nova tabela fMovimentacao...")
    # Linhas para todos os pares com Estoque_Atual > 0
    df_mov = pares_com_estoque[['Filial', 'Codigo_Produto', 'Demanda_Atual']].copy()
    n_mov = len(df_mov)

    # 1. Ultima_Venda sintética:
    # se Demanda_Atual > 0 -> REF - randint(0, 30)d
    # senão: 12% nulo ("nunca vendeu") e 88% -> REF - (31 + Exp(120))d (máx. 3 anos)
    tem_demanda = df_mov['Demanda_Atual'] > 0
    dias_venda = np.zeros(n_mov, dtype=object)

    # Pares com demanda
    dias_com_dem = np.random.randint(0, 31, size=tem_demanda.sum())
    datas_com_dem = (dt_ref - pd.to_timedelta(dias_com_dem, unit='D')).strftime('%Y-%m-%d')
    dias_venda[tem_demanda] = datas_com_dem

    # Pares sem demanda
    sem_dem_count = (~tem_demanda).sum()
    n_nunca = int(sem_dem_count * 0.12)
    n_antiga = sem_dem_count - n_nunca

    exp_dias = 31 + np.random.exponential(scale=120, size=n_antiga)
    exp_dias = np.clip(exp_dias, 31, 3 * 365).astype(int)
    datas_antigas = (dt_ref - pd.to_timedelta(exp_dias, unit='D')).strftime('%Y-%m-%d')

    sem_dem_vals = [None] * n_nunca + list(datas_antigas)
    random.shuffle(sem_dem_vals)
    dias_venda[~tem_demanda] = sem_dem_vals

    df_mov['Venda_Sintetica'] = dias_venda

    # Cruzar com fVendas para max(venda_sintetica, venda_real)
    print("  - Vinculando últimas vendas reais de fVendas...")
    vendas_reais = df_vendas_final.groupby(['Filial', 'Codigo_Produto'])['Data_Venda'].max().reset_index()
    vendas_reais = vendas_reais.rename(columns={'Data_Venda': 'Venda_Real'})

    df_mov = df_mov.merge(vendas_reais, on=['Filial', 'Codigo_Produto'], how='left')

    def combinar_vendas(row):
        vs = row['Venda_Sintetica']
        vr = row['Venda_Real']
        if pd.isna(vs) and pd.isna(vr):
            return None
        if pd.isna(vs):
            return vr
        if pd.isna(vr):
            return vs
        return max(str(vs), str(vr))

    df_mov['Ultima_Venda'] = df_mov.apply(combinar_vendas, axis=1)

    # 2. Ultima_Entrada:
    # REF - randint(5, 420)d; 3% nulo
    n_ent_nulo = int(n_mov * 0.03)
    n_ent_valido = n_mov - n_ent_nulo

    dias_entrada = np.random.randint(5, 421, size=n_ent_valido)
    datas_entrada = (dt_ref - pd.to_timedelta(dias_entrada, unit='D')).strftime('%Y-%m-%d')
    lista_entradas = [None] * n_ent_nulo + list(datas_entrada)
    random.shuffle(lista_entradas)
    df_mov['Ultima_Entrada'] = lista_entradas

    cols_mov = ['Filial', 'Codigo_Produto', 'Ultima_Venda', 'Ultima_Entrada']
    df_mov_final = df_mov[cols_mov].copy()
    df_mov_final.to_csv(DIR_CONSOLIDADOS / "fMovimentacao.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ fMovimentacao consolidado: {len(df_mov_final):,} linhas.")

    # =========================================================================
    # 10. fDivergenciasInventario (reatribuir ao universo, datas <= REF)
    # =========================================================================
    print("\n[10/12] Processando fDivergenciasInventario...")
    df_div_raw = pd.read_csv(DIR_ANONIMIZADOS / "fDivergenciasInventario.csv")
    n_div = len(df_div_raw)

    idx_div_pares = np.random.choice(len(pares_universo), size=n_div, replace=True)
    pares_div = pares_universo.iloc[idx_div_pares].reset_index(drop=True)

    df_div_final = df_div_raw.copy()
    df_div_final['Filial'] = pares_div['Filial'].values
    df_div_final['Codigo_Produto'] = pares_div['Codigo_Produto'].values

    # Ajustar datas > REF
    datas_div_dt = pd.to_datetime(df_div_final['Data'])
    mask_div_futuro = datas_div_dt > dt_ref
    if mask_div_futuro.any():
        dias_novos_div = np.random.randint(0, dias_max_vendas + 1, size=mask_div_futuro.sum())
        novas_datas_div = (start_date_vendas + pd.to_timedelta(dias_novos_div, unit='D')).strftime('%Y-%m-%d')
        df_div_final.loc[mask_div_futuro, 'Data'] = novas_datas_div

    df_div_final.to_csv(DIR_CONSOLIDADOS / "fDivergenciasInventario.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ fDivergenciasInventario consolidado: {len(df_div_final):,} linhas.")

    # =========================================================================
    # 11. fResultadoInventario (reexportar com vírgula, datas <= REF)
    # =========================================================================
    print("\n[11/12] Processando fResultadoInventario (ajustando separador para vírgula)...")
    # Arquivo original utiliza ';'
    df_res_raw = pd.read_csv(DIR_ANONIMIZADOS / "fResultadoInventario.csv", sep=';')

    # Truncar/ajustar datas > REF e padronizar para YYYY-MM-DD
    datas_res_dt = pd.to_datetime(df_res_raw['Data'], dayfirst=True)
    mask_res_futuro = datas_res_dt > dt_ref
    if mask_res_futuro.any():
        dias_novos_res = np.random.randint(0, dias_max_vendas + 1, size=mask_res_futuro.sum())
        novas_datas_res = start_date_vendas + pd.to_timedelta(dias_novos_res, unit='D')
        datas_res_dt = datas_res_dt.copy()
        datas_res_dt[mask_res_futuro] = novas_datas_res

    df_res_raw['Data'] = datas_res_dt.dt.strftime('%Y-%m-%d')
    df_res_raw.to_csv(DIR_CONSOLIDADOS / "fResultadoInventario.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ fResultadoInventario consolidado: {len(df_res_raw):,} linhas.")

    # =========================================================================
    # 12. fBonificacao (datas <= REF, formato limpo)
    # =========================================================================
    print("\n[12/12] Processando fBonificacao...")
    df_bon_raw = pd.read_csv(DIR_ANONIMIZADOS / "fBonificacao.csv")

    datas_bon_dt = pd.to_datetime(df_bon_raw['Data'])
    mask_bon_futuro = datas_bon_dt > dt_ref
    if mask_bon_futuro.any():
        dias_novos_bon = np.random.randint(0, dias_max_vendas + 1, size=mask_bon_futuro.sum())
        novas_datas_bon = (start_date_vendas + pd.to_timedelta(dias_novos_bon, unit='D')).strftime('%Y-%m-%d')
        df_bon_raw.loc[mask_bon_futuro, 'Data'] = novas_datas_bon

    df_bon_raw.to_csv(DIR_CONSOLIDADOS / "fBonificacao.csv", index=False, encoding="utf-8-sig")
    print(f"  ✓ fBonificacao consolidado: {len(df_bon_raw):,} linhas.")

    print("\n" + "=" * 65)
    print("✨ CONSOLIDAÇÃO DA FASE 1 CONCLUÍDA COM SUCESSO!")
    print(f"Arquivos salvos em: {DIR_CONSOLIDADOS}")
    print("=" * 65)


if __name__ == "__main__":
    consolidar_dados()
