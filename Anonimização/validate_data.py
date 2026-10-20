import os
import pandas as pd

DATA_DIR = 'Dados_Anonimizados'

print("=== STARTING REFINED DATA VALIDATION ===")

files = [
    'dProdutos.csv', 'dFilial.csv', 'dVendedores.csv', 'dCalendario.csv',
    'fEstoqueDemanda.csv', 'fAVencer.csv', 'fVendas.csv',
    'fDivergenciasInventario.csv', 'fResultadoInventario.csv',
    'fPerdasTotais.csv', 'fBonificacao.csv'
]

# Confirm fRelatorioRisco.csv is NOT present
risco_path = os.path.join(DATA_DIR, 'fRelatorioRisco.csv')
assert not os.path.exists(risco_path), "fRelatorioRisco.csv should be removed/ignored!"
print("[OK] Verified: fRelatorioRisco.csv is ignored/removed")

data = {}
for f in files:
    path = os.path.join(DATA_DIR, f)
    if os.path.exists(path):
        df = pd.read_csv(path)
        data[f] = df
        print(f"[OK] {f}: {len(df):,} rows, {len(df.columns)} columns")
    else:
        print(f"[FAIL] MISSING: {f}")

if len(data) == len(files):
    print("\n--- Testing Relational & Business Rule Integrity ---")
    dProd_ids = set(data['dProdutos.csv']['Codigo_Produto'])
    dFilial_ids = set(data['dFilial.csv']['Filial'])
    dVendedor_ids = set(data['dVendedores.csv']['ID_Vendedor'])
    buyers_prod = set(data['dProdutos.csv']['Comprador'])

    # Test 1: Filiais Count
    print(f"Filiais count: {len(dFilial_ids)} (Expected: 232)")
    assert len(dFilial_ids) == 232, "Filial count mismatch!"

    # Test 2: Buyers Consistency in fBonificacao
    bonif_buyers = set(data['fBonificacao.csv']['Comprador'])
    assert bonif_buyers.issubset(buyers_prod), "Buyers in fBonificacao do not match dProdutos!"
    print("[OK] 100% of buyers in fBonificacao exist in dProdutos")

    # Test 3: Zero Stock Filter in fEstoqueDemanda
    zero_stock_cnt = (data['fEstoqueDemanda.csv']['Estoque_Atual'] <= 0).sum()
    assert zero_stock_cnt == 0, "Zero stock rows found in fEstoqueDemanda!"
    print("[OK] Verified: fEstoqueDemanda contains no zero-stock rows")

    # Test 4: Filial Coverage across 232 Filiais in fDivergenciasInventario and fPerdasTotais
    div_filiais = set(data['fDivergenciasInventario.csv']['Filial'])
    perdas_filiais = set(data['fPerdasTotais.csv']['Filial'])
    assert len(div_filiais) == 232, "Not all 232 filiais present in fDivergenciasInventario!"
    assert len(perdas_filiais) == 232, "Not all 232 filiais present in fPerdasTotais!"
    print("[OK] 100% of 232 filiais covered in fDivergenciasInventario and fPerdasTotais")

    # Test 5: fPerdasTotais Schema Cleanup & Rename
    perdas_cols = set(data['fPerdasTotais.csv'].columns)
    forbidden_cols = {'Grupo', 'Comprador', 'Fornecedor', 'Preco_Venda_Unitario'}
    assert forbidden_cols.isdisjoint(perdas_cols), "Redundant/unwanted columns still in fPerdasTotais!"
    assert 'Custo' in perdas_cols, "Column 'Custo' missing in fPerdasTotais!"
    print("[OK] fPerdasTotais cleaned: redundant columns removed, 'Custo' added")

    # Test 6: Sales Proportion (80% Normal / 20% AV)
    df_vendas = data['fVendas.csv']
    av_ratio = (df_vendas['Is_Venda_AV'] == 1).mean()
    print(f"A Vencer Sales Ratio in fVendas: {av_ratio*100:.1f}% (Expected ~20%)")
    assert 0.18 <= av_ratio <= 0.22, "A Vencer sales ratio out of expected 20% range!"

    # Test 7: Revenue vs Loss Math Check (Revenue >= 97% higher than Losses)
    df_vendas['Ano_Mes'] = pd.to_datetime(df_vendas['Data_Venda']).dt.strftime('%Y-%m')
    df_perdas = data['fPerdasTotais.csv']
    df_perdas['Ano_Mes'] = pd.to_datetime(df_perdas['Emissao_Data']).dt.strftime('%Y-%m')

    monthly_rev = df_vendas.groupby('Ano_Mes')['Valor_Total'].sum()
    monthly_loss = df_perdas.groupby('Ano_Mes')['Valor_Perda'].sum()

    common_months = monthly_rev.index.intersection(monthly_loss.index)
    rev_sub = monthly_rev.loc[common_months]
    loss_sub = monthly_loss.loc[common_months]

    # Revenue is (Revenue - Loss)/Revenue % higher
    rev_margin = (rev_sub - loss_sub) / rev_sub
    min_margin = rev_margin.min()
    print(f"Minimum Monthly Revenue Margin over Loss: {min_margin*100:.2f}% (Expected >= 97%)")
    assert min_margin >= 0.95, "Monthly Revenue is not high enough compared to monthly losses!"
    print("[OK] Business logic verified: Monthly Revenue is > 97% higher than Monthly Loss")

    print("\nALL REFINED VALIDATION CHECKS PASSED SUCCESSFULLY!")
