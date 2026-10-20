import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score

DATA_DIR = 'Dados_Anonimizados'
OUTPUT_FILE = os.path.join(DATA_DIR, 'fIndicadores_ML.csv')

print("=== STARTING ML & LOSS PREVENTION INDICATORS PIPELINE ===")

# 1. LOAD ANONYMIZED DATASETS
print("Loading anonymized datasets...")
df_prod = pd.read_csv(os.path.join(DATA_DIR, 'dProdutos.csv'))
df_filial = pd.read_csv(os.path.join(DATA_DIR, 'dFilial.csv'))
df_est = pd.read_csv(os.path.join(DATA_DIR, 'fEstoqueDemanda.csv'))
df_av = pd.read_csv(os.path.join(DATA_DIR, 'fAVencer.csv'))
df_vendas = pd.read_csv(os.path.join(DATA_DIR, 'fVendas.csv'))
df_perdas = pd.read_csv(os.path.join(DATA_DIR, 'fPerdasTotais.csv'))
df_div = pd.read_csv(os.path.join(DATA_DIR, 'fDivergenciasInventario.csv'))

# 2. AGGREGATE METRICS AT (Filial, Codigo_Produto) LEVEL
print("Aggregating multi-source operational metrics by Filial and Product...")

# A. Stock & Demand
df_base = df_est[['Filial', 'Codigo_Produto', 'Estoque_Atual', 'Demanda_Atual', 'Demanda_Ponderada']].copy()

# B. Products A Vencer (fAVencer)
av_agg = df_av.groupby(['Filial', 'Codigo_Produto']).agg(
    Qtd_AV=('Estoque', 'sum'),
    Valor_AV=('Total_AV', 'sum')
).reset_index()

# C. Sales (fVendas) - Split into Normal and A Vencer
vendas_norm = df_vendas[df_vendas['Is_Venda_AV'] == 0].groupby(['Filial', 'Codigo_Produto']).agg(
    Qtd_Vendas_Normais=('Quantidade_Vendida', 'sum'),
    Valor_Vendas_Normais=('Valor_Total', 'sum')
).reset_index()

vendas_av = df_vendas[df_vendas['Is_Venda_AV'] == 1].groupby(['Filial', 'Codigo_Produto']).agg(
    Qtd_Vendas_AV=('Quantidade_Vendida', 'sum'),
    Valor_Vendas_AV=('Valor_Total', 'sum')
).reset_index()

# D. Divergences (fDivergenciasInventario)
div_agg = df_div.groupby(['Filial', 'Codigo_Produto']).agg(
    Qtd_Divergencias=('Diferenca_Qtd', 'count'),
    Valor_Divergencia_Abs=('Diferenca_Real_Valor', 'sum')
).reset_index()

# E. Losses (fPerdasTotais)
perdas_agg = df_perdas.groupby(['Filial', 'Codigo_Produto']).agg(
    Qtd_Perdas=('Quantidade', 'sum'),
    Valor_Perdas=('Valor_Perda', 'sum')
).reset_index()

# MERGE ALL FEATURES INTO FEATURE MATRIX
df_features = df_base.merge(av_agg, on=['Filial', 'Codigo_Produto'], how='left') \
                     .merge(vendas_norm, on=['Filial', 'Codigo_Produto'], how='left') \
                     .merge(vendas_av, on=['Filial', 'Codigo_Produto'], how='left') \
                     .merge(div_agg, on=['Filial', 'Codigo_Produto'], how='left') \
                     .merge(perdas_agg, on=['Filial', 'Codigo_Produto'], how='left')

# Fill NaN with 0 for missing activity
fill_cols = ['Qtd_AV', 'Valor_AV', 'Qtd_Vendas_Normais', 'Valor_Vendas_Normais',
             'Qtd_Vendas_AV', 'Valor_Vendas_AV', 'Qtd_Divergencias',
             'Valor_Divergencia_Abs', 'Qtd_Perdas', 'Valor_Perdas']
df_features[fill_cols] = df_features[fill_cols].fillna(0)

# 3. CALCULATE INDICATORS
print("Calculating Loss Prevention Business Indicators...")

# --- INDICADOR 1: COVERAGE & RUPTURA (PRODUCT & STORE LEVEL) ---
# Daily Demand Rate (prevent division by zero)
daily_demand = np.maximum(0.05, df_features['Demanda_Ponderada'] / 30.0)
df_features['Dias_Cobertura'] = np.round(df_features['Estoque_Atual'] / daily_demand, 1)

def calc_ruptura_status(row):
    dias = row['Dias_Cobertura']
    est = row['Estoque_Atual']
    dem = row['Demanda_Atual']
    if est == 0 and dem > 0:
        return 'Ruptura Consumada'
    elif dias < 3.0:
        return 'Crítico / Alto Risco'
    elif dias <= 7.0:
        return 'Risco Moderado'
    else:
        return 'Sem Risco'

df_features['Status_Ruptura'] = df_features.apply(calc_ruptura_status, axis=1)

# --- INDICADOR 2: EXCESSO DE ESTOQUE (STORE LEVEL & PRODUCT LEVEL) ---
df_features['Is_Excesso'] = (df_features['Dias_Cobertura'] > 45.0).astype(int)
df_features['Qtd_Estoque_Excesso'] = np.maximum(0, df_features['Estoque_Atual'] - np.round(df_features['Demanda_Ponderada'] * 1.5))
df_features['Qtd_Estoque_Excesso'] = np.where(df_features['Is_Excesso'] == 1, df_features['Qtd_Estoque_Excesso'], 0)

def calc_excesso_nivel(dias):
    if dias > 90.0:
        return 'Excesso Crítico'
    elif dias > 45.0:
        return 'Excesso Elevado'
    else:
        return 'Estoque Normal'

df_features['Nivel_Excesso'] = df_features['Dias_Cobertura'].apply(calc_excesso_nivel)

# Calculate Store-Level Aggregate Excess Ratio for enrichment
filial_excesso_agg = df_features.groupby('Filial').agg(
    Estoque_Total_Filial=('Estoque_Atual', 'sum'),
    Estoque_Excesso_Filial=('Qtd_Estoque_Excesso', 'sum')
).reset_index()
filial_excesso_agg['Indice_Excesso_Filial_Perc'] = np.round(
    (filial_excesso_agg['Estoque_Excesso_Filial'] / np.maximum(1, filial_excesso_agg['Estoque_Total_Filial'])) * 100, 2
)

df_features = df_features.merge(filial_excesso_agg[['Filial', 'Indice_Excesso_Filial_Perc']], on='Filial', how='left')

# --- INDICADOR 3: MACHINE LEARNING MODEL FOR PRODUCT LOSS RISK ---
print("\n--- Training Machine Learning Risk Prediction Model ---")

# Define Target (Y): Product has significant loss risk
# Product has high loss risk if Valor_Perdas > 15 or (Qtd_AV > 0 and Qtd_Vendas_AV < Qtd_AV * 0.5)
target_condition = (df_features['Valor_Perdas'] > 12.0) | ((df_features['Qtd_AV'] > 0) & (df_features['Qtd_Vendas_AV'] < df_features['Qtd_AV']))
df_features['Target_Risco_Perda'] = target_condition.astype(int)

feature_cols = [
    'Estoque_Atual', 'Demanda_Ponderada', 'Dias_Cobertura',
    'Qtd_AV', 'Valor_AV', 'Qtd_Vendas_Normais', 'Valor_Vendas_Normais',
    'Qtd_Vendas_AV', 'Valor_Vendas_AV', 'Valor_Divergencia_Abs'
]

X = df_features[feature_cols]
y = df_features['Target_Risco_Perda']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

rf_model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    n_jobs=-1
)
rf_model.fit(X_train, y_train)

y_pred = rf_model.predict(X_test)
y_proba = rf_model.predict_proba(X_test)[:, 1]

acc = accuracy_score(y_test, y_pred)
auc = roc_auc_score(y_test, y_proba)

print(f"[ML Model Performance] Accuracy: {acc*100:.2f}% | ROC-AUC Score: {auc:.4f}")
print("Classification Report:")
print(classification_report(y_test, y_pred))

# Predict Loss Risk Probability Score for all rows
df_features['Score_Risco_Perda_ML'] = np.round(rf_model.predict_proba(X)[:, 1], 4)

def calc_categoria_risco(score):
    if score >= 0.75:
        return 'Crítico'
    elif score >= 0.50:
        return 'Alto'
    elif score >= 0.25:
        return 'Médio'
    else:
        return 'Baixo'

df_features['Categoria_Risco_Perda'] = df_features['Score_Risco_Perda_ML'].apply(calc_categoria_risco)

# Feature Importance Summary
importances = pd.DataFrame({
    'Feature': feature_cols,
    'Importance': np.round(rf_model.feature_importances_, 4)
}).sort_values(by='Importance', ascending=False)
print("\nFeature Importances:")
print(importances.to_string(index=False))

# 4. FINAL EXPORT FOR POWER BI
print("\nPreparing final fIndicadores_ML dataset for Power BI...")

# Merge Product Category & Buyer metadata
df_features = df_features.merge(df_prod[['Codigo_Produto', 'Nome_Produto', 'Categoria', 'Comprador']], on='Codigo_Produto', how='left')

output_cols = [
    'Filial', 'Codigo_Produto', 'Nome_Produto', 'Categoria', 'Comprador',
    'Estoque_Atual', 'Demanda_Atual', 'Demanda_Ponderada', 'Dias_Cobertura',
    'Status_Ruptura', 'Qtd_Estoque_Excesso', 'Nivel_Excesso', 'Indice_Excesso_Filial_Perc',
    'Qtd_AV', 'Valor_AV', 'Qtd_Vendas_Normais', 'Qtd_Vendas_AV', 'Qtd_Perdas', 'Valor_Perdas',
    'Score_Risco_Perda_ML', 'Categoria_Risco_Perda'
]

df_final = df_features[output_cols].copy()
df_final.to_csv(OUTPUT_FILE, index=False, encoding='utf-8-sig')

print(f"\n[SUCCESS] Exported {len(df_final):,} rows to '{OUTPUT_FILE}'!")
print("=== ML PIPELINE COMPLETED SUCCESSFULLY ===")
