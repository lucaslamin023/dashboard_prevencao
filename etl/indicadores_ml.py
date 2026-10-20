import os
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score

# Add parent directory to path to allow direct execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.config import DIR_CONSOLIDADOS, SEED


def calcular_indicadores_ml(data_dir=DIR_CONSOLIDADOS, verbose=True):
    """
    Calcula os indicadores operacionais e o modelo de ML conforme lógica de gerar_indicadores_ml.py,
    lendo as bases consolidadas de data_dir.
    Adiciona Valor_Estoque_Custo e Valor_Excesso_Custo (§3.1).
    """
    if verbose:
        print("=== CALCULANDO INDICADORES DE ML & OPERACIONAIS ===")
        print(f"Lendo dados de: {data_dir}")

    df_prod = pd.read_csv(data_dir / 'dProdutos.csv', dtype={'MG': str})
    df_est = pd.read_csv(data_dir / 'fEstoqueDemanda.csv')
    df_av = pd.read_csv(data_dir / 'fAVencer.csv')
    df_vendas = pd.read_csv(data_dir / 'fVendas.csv')
    df_perdas = pd.read_csv(data_dir / 'fPerdasTotais.csv')
    df_div = pd.read_csv(data_dir / 'fDivergenciasInventario.csv')

    # Base: Estoque e Demanda
    df_base = df_est[['Filial', 'Codigo_Produto', 'Estoque_Atual', 'Demanda_Atual', 'Demanda_Ponderada', 'Demanda_Rede']].copy()

    # Agregações por (Filial, Codigo_Produto)
    av_agg = df_av.groupby(['Filial', 'Codigo_Produto'], as_index=False).agg(
        Qtd_AV=('Estoque', 'sum'),
        Valor_AV=('Total_AV', 'sum')
    )

    vendas_norm = df_vendas[df_vendas['Is_Venda_AV'] == 0].groupby(['Filial', 'Codigo_Produto'], as_index=False).agg(
        Qtd_Vendas_Normais=('Quantidade_Vendida', 'sum'),
        Valor_Vendas_Normais=('Valor_Total', 'sum')
    )

    vendas_av = df_vendas[df_vendas['Is_Venda_AV'] == 1].groupby(['Filial', 'Codigo_Produto'], as_index=False).agg(
        Qtd_Vendas_AV=('Quantidade_Vendida', 'sum'),
        Valor_Vendas_AV=('Valor_Total', 'sum')
    )

    div_agg = df_div.groupby(['Filial', 'Codigo_Produto'], as_index=False).agg(
        Qtd_Divergencias=('Diferenca_Qtd', 'count'),
        Valor_Divergencia_Abs=('Diferenca_Real_Valor', 'sum')
    )

    perdas_agg = df_perdas.groupby(['Filial', 'Codigo_Produto'], as_index=False).agg(
        Qtd_Perdas=('Quantidade', 'sum'),
        Valor_Perdas=('Valor_Perda', 'sum')
    )

    # Merge de todas as features
    df_features = df_base.merge(av_agg, on=['Filial', 'Codigo_Produto'], how='left') \
                         .merge(vendas_norm, on=['Filial', 'Codigo_Produto'], how='left') \
                         .merge(vendas_av, on=['Filial', 'Codigo_Produto'], how='left') \
                         .merge(div_agg, on=['Filial', 'Codigo_Produto'], how='left') \
                         .merge(perdas_agg, on=['Filial', 'Codigo_Produto'], how='left')

    fill_cols = [
        'Qtd_AV', 'Valor_AV', 'Qtd_Vendas_Normais', 'Valor_Vendas_Normais',
        'Qtd_Vendas_AV', 'Valor_Vendas_AV', 'Qtd_Divergencias',
        'Valor_Divergencia_Abs', 'Qtd_Perdas', 'Valor_Perdas'
    ]
    df_features[fill_cols] = df_features[fill_cols].fillna(0)

    # 1. Indicador de Cobertura e Ruptura
    daily_demand = np.maximum(0.05, df_features['Demanda_Ponderada'] / 30.0)
    df_features['Dias_Cobertura'] = np.round(df_features['Estoque_Atual'] / daily_demand, 1)

    # Vetorização de calc_ruptura_status
    cond_rupt = [
        (df_features['Estoque_Atual'] == 0) & (df_features['Demanda_Atual'] > 0),
        df_features['Dias_Cobertura'] < 3.0,
        df_features['Dias_Cobertura'] <= 7.0,
    ]
    escolhas_rupt = [
        'Ruptura Consumada',
        'Crítico / Alto Risco',
        'Risco Moderado'
    ]
    df_features['Status_Ruptura'] = np.select(cond_rupt, escolhas_rupt, default='Sem Risco')

    # 2. Indicador de Excesso de Estoque
    df_features['Is_Excesso'] = (df_features['Dias_Cobertura'] > 45.0).astype(int)
    dem_pond_limit = np.round(df_features['Demanda_Ponderada'] * 1.5)
    qtd_excesso = np.maximum(0, df_features['Estoque_Atual'] - dem_pond_limit)
    df_features['Qtd_Estoque_Excesso'] = np.where(df_features['Is_Excesso'] == 1, qtd_excesso, 0)

    cond_exc = [
        df_features['Dias_Cobertura'] > 90.0,
        df_features['Dias_Cobertura'] > 45.0,
    ]
    escolhas_exc = [
        'Excesso Crítico',
        'Excesso Elevado'
    ]
    df_features['Nivel_Excesso'] = np.select(cond_exc, escolhas_exc, default='Estoque Normal')

    # Índice de Excesso agregado por Filial
    filial_excesso_agg = df_features.groupby('Filial').agg(
        Estoque_Total_Filial=('Estoque_Atual', 'sum'),
        Estoque_Excesso_Filial=('Qtd_Estoque_Excesso', 'sum')
    ).reset_index()
    filial_excesso_agg['Indice_Excesso_Filial_Perc'] = np.round(
        (filial_excesso_agg['Estoque_Excesso_Filial'] / np.maximum(1, filial_excesso_agg['Estoque_Total_Filial'])) * 100, 2
    )

    df_features = df_features.merge(filial_excesso_agg[['Filial', 'Indice_Excesso_Filial_Perc']], on='Filial', how='left')

    # 3. Modelo de Machine Learning (Random Forest)
    if verbose:
        print("Treinando modelo de Machine Learning (Random Forest)...")

    target_condition = (df_features['Valor_Perdas'] > 12.0) | ((df_features['Qtd_AV'] > 0) & (df_features['Qtd_Vendas_AV'] < df_features['Qtd_AV']))
    df_features['Target_Risco_Perda'] = target_condition.astype(int)

    feature_cols = [
        'Estoque_Atual', 'Demanda_Ponderada', 'Dias_Cobertura',
        'Qtd_AV', 'Valor_AV', 'Qtd_Vendas_Normais', 'Valor_Vendas_Normais',
        'Qtd_Vendas_AV', 'Valor_Vendas_AV', 'Valor_Divergencia_Abs'
    ]

    X = df_features[feature_cols]
    y = df_features['Target_Risco_Perda']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=SEED, stratify=y)

    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=SEED,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)

    y_pred = rf_model.predict(X_test)
    y_proba = rf_model.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    if verbose:
        print(f"[ML Model Performance] Acurácia: {acc*100:.2f}% | ROC-AUC: {auc:.4f}")

    df_features['Score_Risco_Perda_ML'] = np.round(rf_model.predict_proba(X)[:, 1], 4)

    cond_cat_ml = [
        df_features['Score_Risco_Perda_ML'] >= 0.75,
        df_features['Score_Risco_Perda_ML'] >= 0.50,
        df_features['Score_Risco_Perda_ML'] >= 0.25,
    ]
    escolhas_cat_ml = ['Crítico', 'Alto', 'Médio']
    df_features['Categoria_Risco_Perda'] = np.select(cond_cat_ml, escolhas_cat_ml, default='Baixo')

    # Merge metadados de produto e cálculo dos valores a custo (§3.1)
    df_features = df_features.merge(
        df_prod[['Codigo_Produto', 'Nome_Produto', 'Categoria', 'Comprador', 'Custo_Referencia']],
        on='Codigo_Produto',
        how='left'
    )

    df_features['Valor_Estoque_Custo'] = np.round(df_features['Estoque_Atual'] * df_features['Custo_Referencia'], 2)
    df_features['Valor_Excesso_Custo'] = np.round(df_features['Qtd_Estoque_Excesso'] * df_features['Custo_Referencia'], 2)

    return df_features
