import os
import random
import datetime
import numpy as np
import pandas as pd

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

OUTPUT_DIR = 'Dados_Anonimizados'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Remove fRelatorioRisco.csv if it exists
risco_path = os.path.join(OUTPUT_DIR, 'fRelatorioRisco.csv')
if os.path.exists(risco_path):
    try:
        os.remove(risco_path)
        print("Removed fRelatorioRisco.csv as requested.")
    except Exception as e:
        print(f"Could not remove fRelatorioRisco.csv: {e}")

print("=== STARTING REFINED ETL ANONYMIZATION PROCESS ===")

# 1. LOAD AUXILIARY DATASETS
print("Loading reference datasets...")
df_pharma = pd.read_csv('indian_pharmaceutical_products_clean.csv')
df_cosmetics = pd.read_csv('cosmetics.csv')

pharma_names = df_pharma['brand_name'].dropna().tolist()
pharma_ingredients = df_pharma['primary_ingredient'].dropna().unique().tolist()
pharma_classes = df_pharma['therapeutic_class'].dropna().unique().tolist()
pharma_mfg = df_pharma['manufacturer'].dropna().unique().tolist()

cosmetic_names = (df_cosmetics['Brand'] + ' ' + df_cosmetics['Name']).dropna().tolist()

# Load Excel workbook
excel_path = 'Bases Reais.xlsx'
print(f"Loading Excel workbook '{excel_path}'...")
xl = pd.ExcelFile(excel_path)

# NEW BUYERS POOL (Used in dProdutos and fBonificacao)
buyers_pool = [
    'Marcio Santos', 'Elena Rostova', 'Arthur Pendelton', 'Sofia Alcantara',
    'Lucas Takahashi', 'Beatriz Hoffmann', 'David Miller', 'Camila Benitez',
    'Henrique Fonseca', 'Clara Vance'
]

suppliers_pool = [m for m in pharma_mfg if len(str(m)) > 3][:50]
if not suppliers_pool:
    suppliers_pool = ['Eurofarma Lab', 'Medley Pharma', 'EMS S/A', 'Aché Laboratórios', 'Bayer HealthCare', 'Cimed Remédios', 'Hypera Pharma', 'Pfizer Brasil']

# ==========================================
# DIMENSION 1: PRODUTOS (dProdutos)
# ==========================================
print("\n--- Processing dProdutos ---")
df_raw_prod = xl.parse('Dados Produtos')

real_codes = df_raw_prod['Código'].dropna().unique()
num_products = len(real_codes)
masked_product_codes = [100001 + i for i in range(num_products)]
dict_prod_map = dict(zip(real_codes, masked_product_codes))

sample_pharma_names = random.choices(pharma_names, k=int(num_products * 0.75))
sample_cosmetic_names = random.choices(cosmetic_names, k=num_products - len(sample_pharma_names))
product_names = sample_pharma_names + sample_cosmetic_names
random.shuffle(product_names)

categories_pool = [
    'Medicamentos Isentos (MIP)', 'Prescrição Médica', 'Dermocosméticos',
    'Higiene & Cuidados Pessoais', 'Suplementos & Vitaminas', 'Primeiros Socorros',
    'Mamãe & Bebê', 'Nutrição Esportiva', 'Cosméticos Capilares', 'Beleza & Maquiagem'
]

dProdutos = pd.DataFrame({
    'Codigo_Produto': masked_product_codes,
    'Nome_Produto': product_names,
    'Categoria': [random.choice(categories_pool) for _ in range(num_products)],
    'Principio_Ativo': [random.choice(pharma_ingredients) if i < len(sample_pharma_names) else 'N/A (Cosmético)' for i in range(num_products)],
    'Classe_Terapeutica': [random.choice(pharma_classes) if i < len(sample_pharma_names) else 'Cosméticos & Beleza' for i in range(num_products)],
    'Fornecedor': [random.choice(suppliers_pool) for _ in range(num_products)],
    'Comprador': [random.choice(buyers_pool) for _ in range(num_products)],
    'Custo_Referencia': np.round(np.random.uniform(3.50, 45.00, size=num_products), 2)  # Controlled realistic product costs
})

dProdutos.to_csv(os.path.join(OUTPUT_DIR, 'dProdutos.csv'), index=False, encoding='utf-8-sig')
print(f"Saved dProdutos.csv ({len(dProdutos)} rows)")

# ==========================================
# DIMENSION 2: FILIAL (dFilial) - 232 Filiais
# ==========================================
print("\n--- Processing dFilial (232 Filiais) ---")
df_raw_filial = xl.parse('Filial')
real_filiais = df_raw_filial['Filial'].dropna().astype(int).unique()

TOTAL_FILIAIS = 232
filial_ids = list(range(1, TOTAL_FILIAIS + 1))
dict_filial_map = {f: f for f in real_filiais}

countries_regions = [
    ('Brasil', 'Sudeste'), ('Brasil', 'Sul'), ('Brasil', 'Nordeste'), ('Brasil', 'Centro-Oeste'), ('Brasil', 'Norte'),
    ('Portugal', 'Lisboa/Porto'), ('Espanha', 'Madri/Catalunha'), ('Argentina', 'Buenos Aires'),
    ('Chile', 'Santiago'), ('México', 'Cidade do México'), ('Uruguai', 'Montevidéu'), ('Colômbia', 'Bogotá')
]

supervisors_by_country = {
    'Brasil - Sudeste': 'Ricardo Menezes',
    'Brasil - Sul': 'Fernanda Garcia',
    'Brasil - Nordeste': 'Marcelo Barbosa',
    'Brasil - Centro-Oeste': 'Juliana Costa',
    'Brasil - Norte': 'Thiago Martins',
    'Portugal': 'João Pedro Silva',
    'Espanha': 'Carlos Gomez',
    'Argentina': 'Mateo Rossi',
    'Chile': 'Gonzalo Fernandez',
    'México': 'Alejandro Hernandez',
    'Uruguai': 'Lucia Morales',
    'Colômbia': 'Camila Vargas'
}

cities_by_region = [
    ('São Paulo', 'SP'), ('Rio de Janeiro', 'RJ'), ('Belo Horizonte', 'MG'), ('Niterói', 'RJ'),
    ('Porto Alegre', 'RS'), ('Curitiba', 'PR'), ('Florianópolis', 'SC'), ('Salvador', 'BA'),
    ('Recife', 'PE'), ('Fortaleza', 'CE'), ('Brasília', 'DF'), ('Goiânia', 'GO'),
    ('Campinas', 'SP'), ('Santos', 'SP'), ('Vitoria', 'ES'), ('Lisboa', 'PT'),
    ('Porto', 'PT'), ('Madri', 'ES'), ('Buenos Aires', 'AR'), ('Santiago', 'CL')
]

managers_pool = ['Ana Carolina', 'Patrícia Rocha', 'Rodrigo Alves', 'Beatriz Lima', 'Gabriel Souza', 'Mariana Freitas', 'Lucas Oliveira', 'Vanessa Carneiro']

dFilial_rows = []
for fid in filial_ids:
    c_info = random.choice(countries_regions)
    country, reg = c_info[0], c_info[1]
    sup_key = f"{country} - {reg}" if country == 'Brasil' else country
    sup_name = supervisors_by_country.get(sup_key, 'Supervisor Regional')
    city, state = random.choice(cities_by_region)
    cnpj_base = f"{random.randint(10,99)}.{random.randint(100,999)}.{random.randint(100,999)}/0001-{random.randint(10,99)}"
    
    dFilial_rows.append({
        'Filial': fid,
        'Nome_Filial': f'Filial {fid:03d} - {city}',
        'Pais': country,
        'Regiao': reg,
        'Supervisor': sup_name,
        'Cidade': city,
        'Estado': state,
        'Endereco': f'Av. Principal nº {random.randint(100,2500)} - Centro, {city}',
        'CNPJ': cnpj_base,
        'Gerente': random.choice(managers_pool),
        'Horario_Abertura': '07:00',
        'Horario_Fechamento': '22:00',
        'Farmacia_Popular': random.choice(['SIM', 'NÃO'])
    })

dFilial = pd.DataFrame(dFilial_rows)
dFilial.to_csv(os.path.join(OUTPUT_DIR, 'dFilial.csv'), index=False, encoding='utf-8-sig')
print(f"Saved dFilial.csv ({len(dFilial)} rows)")

# ==========================================
# DIMENSION 3: VENDEDORES (dVendedores - Multicultural)
# ==========================================
print("\n--- Processing dVendedores (Multicultural Names) ---")
df_raw_vendedores = xl.parse('Vendedores')
real_vendedor_ids = df_raw_vendedores['ID_VENDEDOR'].dropna().unique()
num_vendedores = len(real_vendedor_ids)

masked_vendedor_ids = [1000 + i for i in range(num_vendedores)]
dict_vendedor_map = dict(zip(real_vendedor_ids, masked_vendedor_ids))

first_names_multi = [
    'Ana', 'Bruno', 'Carla', 'Diego', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Lucas', 'Mariana', 'Sofia', 'Thiago',
    'John', 'Emily', 'Alexander', 'Sophia', 'Michael', 'Emma', 'Daniel', 'Olivia',  # Anglo
    'Mateo', 'Lucia', 'Alejandro', 'Valentina', 'Santiago', 'Camila', 'Javier',  # Hispanic
    'Pierre', 'Camille', 'Antoine', 'Claire',  # French
    'Klaus', 'Greta', 'Lukas', 'Frederik',  # European/Germanic
    'Hiroshi', 'Yuki', 'Kenji', 'Mei'  # Asian
]

last_names_multi = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller',  # Anglo
    'Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzales',  # Hispanic
    'Dubois', 'Moreau', 'Laurent',  # French
    'Fischer', 'Weber', 'Schneider',  # Germanic
    'Tanaka', 'Saito', 'Takahashi'  # Asian
]

fake_seller_names = [f"{random.choice(first_names_multi)} {random.choice(last_names_multi)}" for _ in range(num_vendedores)]

dVendedores = pd.DataFrame({
    'ID_Vendedor': masked_vendedor_ids,
    'Nome_Vendedor': fake_seller_names
})

dVendedores.to_csv(os.path.join(OUTPUT_DIR, 'dVendedores.csv'), index=False, encoding='utf-8-sig')
print(f"Saved dVendedores.csv ({len(dVendedores)} rows)")

# ==========================================
# DIMENSION 4: CALENDÁRIO (dCalendario)
# ==========================================
print("\n--- Generating dCalendario ---")
start_date = datetime.date(2019, 1, 1)
end_date = datetime.date(2026, 12, 31)
date_range = pd.date_range(start=start_date, end=end_date, freq='D')

month_names_pt = {
    1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
    7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
}

day_names_pt = {
    0: 'Segunda-feira', 1: 'Terça-feira', 2: 'Quarta-feira', 3: 'Quinta-feira',
    4: 'Sexta-feira', 5: 'Sábado', 6: 'Domingo'
}

dCalendario = pd.DataFrame({
    'Data': date_range.strftime('%Y-%m-%d'),
    'Ano': date_range.year,
    'Mes_Num': date_range.month,
    'Nome_Mes': [month_names_pt[m] for m in date_range.month],
    'Ano_Mes': date_range.strftime('%Y-%m'),
    'Trimestre': [f'{q}º Trimestre' for q in date_range.quarter],
    'Dia': date_range.day,
    'Dia_Semana_Num': date_range.dayofweek + 1,
    'Nome_Dia_Semana': [day_names_pt[d] for d in date_range.dayofweek],
    'Semana_Ano': date_range.isocalendar().week,
    'E_Fim_De_Semana': [1 if d >= 5 else 0 for d in date_range.dayofweek]
})

dCalendario.to_csv(os.path.join(OUTPUT_DIR, 'dCalendario.csv'), index=False, encoding='utf-8-sig')
print(f"Saved dCalendario.csv ({len(dCalendario)} rows)")

def get_masked_filial(val):
    try:
        val_int = int(val)
        if val_int in dict_filial_map:
            return dict_filial_map[val_int]
    except:
        pass
    return random.randint(1, TOTAL_FILIAIS)

# ==========================================
# FACT 1: ESTOQUE DEMANDA (fEstoqueDemanda) - Clean Zero Stock & All 232 Filiais Covered
# ==========================================
print("\n--- Processing fEstoqueDemanda (Removing Zero Stock & Expanding to All 232 Filiais) ---")
df_raw_est = xl.parse('Estoque Demanda')

mapped_prods = df_raw_est['COD_PRD'].map(dict_prod_map).fillna(pd.Series(np.random.choice(masked_product_codes, size=len(df_raw_est))))
mapped_filiais = df_raw_est['FILIAL'].apply(get_masked_filial)

# Filter out non-zero stock
raw_estoque = df_raw_est['ESTOQUE_ATUAL'].fillna(0)
raw_demanda = df_raw_est['DEMANDA_ATUAL'].fillna(0)
valid_mask = raw_estoque > 0

fEst_part1 = pd.DataFrame({
    'Filial': mapped_filiais[valid_mask].astype(int),
    'Codigo_Produto': mapped_prods[valid_mask].astype(int),
    'Demanda_Atual': np.maximum(1, raw_demanda[valid_mask] + np.random.randint(-1, 3, size=valid_mask.sum())),
    'Estoque_Atual': np.maximum(1, raw_estoque[valid_mask] + np.random.randint(1, 10, size=valid_mask.sum())),
    'Demanda_Rede': np.maximum(1, df_raw_est.loc[valid_mask, 'DEMANDA REDE'].fillna(1)),
    'Demanda_Ponderada': np.round(df_raw_est.loc[valid_mask, 'DEMANDA_PONDERADA'].fillna(1.0), 2)
})

# Generate synthetic stock & demand for expanded filiais 81..232 to ensure 100% 232 filiais coverage
extra_filiais_pool = list(range(81, TOTAL_FILIAIS + 1))
num_extra_rows = 400000

fEst_part2 = pd.DataFrame({
    'Filial': np.random.choice(extra_filiais_pool, size=num_extra_rows),
    'Codigo_Produto': np.random.choice(masked_product_codes, size=num_extra_rows),
    'Demanda_Atual': np.random.randint(1, 40, size=num_extra_rows),
    'Estoque_Atual': np.random.randint(5, 120, size=num_extra_rows),
    'Demanda_Rede': np.random.randint(20, 300, size=num_extra_rows),
    'Demanda_Ponderada': np.round(np.random.uniform(2.0, 35.0, size=num_extra_rows), 2)
})

fEstoqueDemanda = pd.concat([fEst_part1, fEst_part2], ignore_index=True)
fEstoqueDemanda.to_csv(os.path.join(OUTPUT_DIR, 'fEstoqueDemanda.csv'), index=False, encoding='utf-8-sig')
print(f"Saved fEstoqueDemanda.csv ({len(fEstoqueDemanda)} rows, zero stock removed, all 232 filiais covered)")

# ==========================================
# FACT 2: A VENCER (fAVencer)
# ==========================================
print("\n--- Processing fAVencer ---")
df_raw_av = xl.parse('A vencer')

mapped_av_prods = df_raw_av['CÓDIGO'].map(dict_prod_map).fillna(pd.Series(np.random.choice(masked_product_codes, size=len(df_raw_av))))
mapped_av_filiais = np.random.randint(1, TOTAL_FILIAIS + 1, size=len(df_raw_av))  # Distributed across all 232 filiais
dates_vencimento = pd.to_datetime(df_raw_av['VENCIMENTO'], errors='coerce').dt.strftime('%Y-%m-%d').fillna('2026-12-31')

fAVencer = pd.DataFrame({
    'Filial': mapped_av_filiais,
    'ZJ1_ID': df_raw_av['ZJ1_ID'].fillna(0).astype(int),
    'Codigo_Produto': mapped_av_prods.astype(int),
    'EAN': [f"789{random.randint(1000000000, 9999999999)}" for _ in range(len(df_raw_av))],
    'Vencimento': dates_vencimento,
    'Resolvido': df_raw_av['RESOLVIDO'].fillna('NÃO'),
    'ZJ1_Lote': [f"LT-{random.randint(10000,99999)}" for _ in range(len(df_raw_av))],
    'Demanda': np.maximum(1, df_raw_av['DEMANDA'].fillna(1)),
    'Estoque': np.maximum(1, df_raw_av['ESTOQUE'].fillna(1)),
    'Custo_Unitario': np.round(np.random.uniform(2.50, 22.00, size=len(df_raw_av)), 2),
    'Total_AV': np.round(np.random.uniform(5.00, 85.00, size=len(df_raw_av)), 2),
    'Preco_Venda': np.round(np.random.uniform(6.00, 45.00, size=len(df_raw_av)), 2),
    'Comprador': [random.choice(buyers_pool) for _ in range(len(df_raw_av))],
    'Fornecedor': [random.choice(suppliers_pool) for _ in range(len(df_raw_av))],
    'Chave': pd.Series(mapped_av_filiais).astype(str) + '_' + df_raw_av['ZJ1_ID'].fillna(0).astype(int).astype(str)
})

fAVencer.to_csv(os.path.join(OUTPUT_DIR, 'fAVencer.csv'), index=False, encoding='utf-8-sig')
print(f"Saved fAVencer.csv ({len(fAVencer)} rows)")

# ==========================================
# FACT 3: VENDAS (fVendas - 80% General Sales, 20% A Vencer Sales & Realistic Revenue Math)
# ==========================================
print("\n--- Processing fVendas (80% Normal Sales / 20% A Vencer Sales) ---")

TOTAL_VENDAS_ROWS = 250000
num_av_sales = int(TOTAL_VENDAS_ROWS * 0.20)      # 50,000 rows (20%)
num_normal_sales = TOTAL_VENDAS_ROWS - num_av_sales # 200,000 rows (80%)

start_dt = pd.Timestamp('2023-01-01')
end_dt = pd.Timestamp('2026-12-31')
days_diff = (end_dt - start_dt).days

# Part 1: A Vencer Sales (Lower average price, clearance discount)
random_days_av = np.random.randint(0, days_diff + 1, size=num_av_sales)
dates_av_sales = (start_dt + pd.to_timedelta(random_days_av, unit='D')).strftime('%Y-%m-%d')
qty_av = np.random.randint(1, 4, size=num_av_sales)
unit_price_av = np.round(np.random.uniform(4.00, 18.00, size=num_av_sales), 2) # Discounted clearance price
total_price_av = np.round(qty_av * unit_price_av, 2)

df_vendas_av = pd.DataFrame({
    'ID_Venda': [f"VND-AV-{i:06d}" for i in range(1, num_av_sales + 1)],
    'Data_Venda': dates_av_sales,
    'Filial': np.random.randint(1, TOTAL_FILIAIS + 1, size=num_av_sales),
    'ID_Vendedor': np.random.choice(masked_vendedor_ids, size=num_av_sales),
    'Codigo_Produto': np.random.choice(masked_product_codes, size=num_av_sales),
    'Tipo_Venda': 'V',
    'Quantidade_Vendida': qty_av,
    'Valor_Unitario': unit_price_av,
    'Valor_Total': total_price_av,
    'Is_Venda_AV': 1
})

# Part 2: Normal Sales (Higher average price & larger volumes to ensure monthly revenue is >= 97% higher than monthly loss)
random_days_norm = np.random.randint(0, days_diff + 1, size=num_normal_sales)
dates_norm_sales = (start_dt + pd.to_timedelta(random_days_norm, unit='D')).strftime('%Y-%m-%d')
qty_norm = np.random.randint(1, 5, size=num_normal_sales)
unit_price_norm = np.round(np.random.uniform(45.00, 180.00, size=num_normal_sales), 2) # Higher standard price for strong revenue margin
total_price_norm = np.round(qty_norm * unit_price_norm, 2)

df_vendas_norm = pd.DataFrame({
    'ID_Venda': [f"VND-NOR-{i:06d}" for i in range(1, num_normal_sales + 1)],
    'Data_Venda': dates_norm_sales,
    'Filial': np.random.randint(1, TOTAL_FILIAIS + 1, size=num_normal_sales),
    'ID_Vendedor': np.random.choice(masked_vendedor_ids, size=num_normal_sales),
    'Codigo_Produto': np.random.choice(masked_product_codes, size=num_normal_sales),
    'Tipo_Venda': 'V',
    'Quantidade_Vendida': qty_norm,
    'Valor_Unitario': unit_price_norm,
    'Valor_Total': total_price_norm,
    'Is_Venda_AV': 0
})

fVendas = pd.concat([df_vendas_av, df_vendas_norm], ignore_index=True)
fVendas.to_csv(os.path.join(OUTPUT_DIR, 'fVendas.csv'), index=False, encoding='utf-8-sig')
print(f"Saved fVendas.csv ({len(fVendas)} rows: {num_normal_sales} Normal Sales [80%] + {num_av_sales} AV Sales [20%])")

# ==========================================
# FACT 4: DIVERGÊNCIAS INVENTÁRIO (fDivergenciasInventario - Filiais 1 to 232)
# ==========================================
print("\n--- Processing fDivergenciasInventario (All 232 Filiais Covered) ---")
df_raw_div = xl.parse('Divergências Inventário')

raw_div_rows = len(df_raw_div)
mapped_div_prods = df_raw_div['CODIGO'].map(dict_prod_map).fillna(pd.Series(np.random.choice(masked_product_codes, size=raw_div_rows)))
mapped_div_filiais = np.random.randint(1, TOTAL_FILIAIS + 1, size=raw_div_rows) # Distributed across all 232 filiais

random_days_div = np.random.randint(0, days_diff + 1, size=raw_div_rows)
dates_div = (start_dt + pd.to_timedelta(random_days_div, unit='D')).strftime('%Y-%m-%d')

val_antes = np.round(np.random.uniform(15.00, 350.00, size=raw_div_rows), 2)
val_dif = np.round(np.random.uniform(-45.00, 45.00, size=raw_div_rows), 2)
dif_real = np.abs(val_dif)

tipo_div_pool = ['SOBRA', 'FALTA', 'DIVERGÊNCIA LOTE', 'CADASTRO INVERTIDO']

fDivergenciasInventario = pd.DataFrame({
    'Filial': mapped_div_filiais,
    'Codigo_Produto': mapped_div_prods.astype(int),
    'Data': dates_div,
    'Saldo_Antes': np.random.randint(0, 50, size=raw_div_rows),
    'Saldo_Depois': np.random.randint(0, 50, size=raw_div_rows),
    'Diferenca_Qtd': np.random.randint(-5, 6, size=raw_div_rows),
    'Valor_Antes': val_antes,
    'Valor_Diferenca': val_dif,
    'Diferenca_Real_Valor': dif_real,
    'Tipo_Divergencia': [random.choice(tipo_div_pool) for _ in range(raw_div_rows)],
    'Identificacao': df_raw_div['IDENTIFICAÇÃO'].fillna('SEM IDENTIFICAÇÃO')
})

fDivergenciasInventario.to_csv(os.path.join(OUTPUT_DIR, 'fDivergenciasInventario.csv'), index=False, encoding='utf-8-sig')
print(f"Saved fDivergenciasInventario.csv ({len(fDivergenciasInventario)} rows across all 232 filiais)")

# ==========================================
# FACT 5: RESULTADO INVENTÁRIO (fResultadoInventario)
# ==========================================
print("\n--- Processing fResultadoInventario ---")
df_raw_res = xl.parse('Resultado Inventário')

res_filiais = np.random.randint(1, TOTAL_FILIAIS + 1, size=len(df_raw_res))
random_days_res = np.random.randint(0, days_diff + 1, size=len(df_raw_res))
res_dates = (start_dt + pd.to_timedelta(random_days_res, unit='D')).strftime('%Y-%m-%d')

estoque_ant = np.abs(df_raw_res['RESULTADO $ GERAL - ESTOQUE ANTERIOR'].fillna(150000))
valor_sobra = np.abs(df_raw_res['RESULTADO $ GERAL - PASSOU'].fillna(3500))
valor_falta = np.abs(df_raw_res['RESULTADO $ GERAL - FALTOU'].fillna(4500))
dif_falta_sobra = valor_sobra - valor_falta
val_abs_soma = valor_sobra + valor_falta

perc_div_abs = np.round(np.divide(val_abs_soma, estoque_ant, out=np.zeros_like(estoque_ant), where=estoque_ant!=0), 4)
perc_dif_estoque = np.round(np.divide(dif_falta_sobra, estoque_ant, out=np.zeros_like(estoque_ant), where=estoque_ant!=0), 4)

valor_total_sobra = valor_sobra
unidentified_factor = np.random.uniform(0.15, 0.38, size=len(df_raw_res))
valor_faltas_nao_identificadas = np.round(valor_falta * unidentified_factor, 2)

fResultadoInventario = pd.DataFrame({
    'Filial': res_filiais,
    'Data': res_dates,
    'Estoque_Anterior_Valor': np.round(estoque_ant, 2),
    'Valor_Sobra': np.round(valor_sobra, 2),
    'Valor_Falta': np.round(valor_falta, 2),
    'Valor_Total_Sobra': np.round(valor_total_sobra, 2),
    'Valor_Faltas_Nao_Identificadas': valor_faltas_nao_identificadas,
    'Diferenca_Falta_Sobra_Valor': np.round(dif_falta_sobra, 2),
    'Valor_Absoluto_Soma_Falta_Sobra': np.round(val_abs_soma, 2),
    'Resultado_Perc_Divergencia_Absoluta': perc_div_abs,
    'Resultado_Perc_Diferenca_Estoque_Anterior': perc_dif_estoque,
    'Metodo': df_raw_res['MÉTODO'].fillna('PADRÃO')
})

fResultadoInventario.to_csv(os.path.join(OUTPUT_DIR, 'fResultadoInventario.csv'), index=False, encoding='utf-8-sig')
print(f"Saved fResultadoInventario.csv ({len(fResultadoInventario)} rows)")

# ==========================================
# FACT 6: PERDAS TOTAIS (fPerdasTotais - Clean Columns, Controlled Costs & All 232 Filiais Covered)
# ==========================================
print("\n--- Processing fPerdasTotais (Cleaned Columns: Custo, Filiais 1 to 232, Controlled Loss Amounts) ---")
df_raw_perdas = xl.parse('Perdas Totais')

raw_perdas_rows = len(df_raw_perdas)
mapped_p_prods = df_raw_perdas['CÓDIGO PRODUTO'].map(dict_prod_map).fillna(pd.Series(np.random.choice(masked_product_codes, size=raw_perdas_rows)))
mapped_p_filiais = np.random.randint(1, TOTAL_FILIAIS + 1, size=raw_perdas_rows) # Distributed across all 232 filiais

random_days_perdas = np.random.randint(0, days_diff + 1, size=raw_perdas_rows)
dates_emissao = (start_dt + pd.to_timedelta(random_days_perdas, unit='D')).strftime('%Y-%m-%d')

qty_perda = np.random.randint(1, 3, size=raw_perdas_rows)
custo_unit = np.round(np.random.uniform(0.90, 8.50, size=raw_perdas_rows), 2) # Controlled unit cost
valor_perda = np.round(qty_perda * custo_unit, 2) # Total loss value per line

motivos_pool = ['DANIFICADO', 'VENCIMENTO', 'AVARIA TRANSPORTE', 'QUEBRA INTERNA', 'DESCARTE SANITÁRIO']

fPerdasTotais = pd.DataFrame({
    'Emissao_Data': dates_emissao,
    'Filial': mapped_p_filiais,
    'Codigo_Produto': mapped_p_prods.astype(int),
    'Motivo_Perda': [random.choice(motivos_pool) for _ in range(raw_perdas_rows)],
    'Quantidade': qty_perda,
    'Custo': custo_unit,
    'Valor_Perda': valor_perda
})

fPerdasTotais.to_csv(os.path.join(OUTPUT_DIR, 'fPerdasTotais.csv'), index=False, encoding='utf-8-sig')
print(f"Saved fPerdasTotais.csv ({len(fPerdasTotais)} rows, removed Grupo/Comprador/Fornecedor, all 232 filiais covered)")

# ==========================================
# FACT 7: BONIFICAÇÃO (fBonificacao - Strictly Matching Buyers from dProdutos)
# ==========================================
print("\n--- Processing fBonificacao (Strict Buyer Matching) ---")
df_raw_bonif = xl.parse('Bonificação')

random_days_bonif = np.random.randint(0, days_diff + 1, size=len(df_raw_bonif))
dates_bonif = (start_dt + pd.to_timedelta(random_days_bonif, unit='D')).strftime('%Y-%m-%d')

fBonificacao = pd.DataFrame({
    'Data': dates_bonif,
    'Comprador': [random.choice(buyers_pool) for _ in range(len(df_raw_bonif))],
    'Fornecedor': [random.choice(suppliers_pool) for _ in range(len(df_raw_bonif))],
    'Numero_NF': df_raw_bonif['NF'].fillna(1001).astype(int),
    'Valor_Bonificacao': np.round(np.random.uniform(250.00, 3500.00, size=len(df_raw_bonif)), 2),
    'Observacao': df_raw_bonif['OBS'].fillna('')
})

fBonificacao.to_csv(os.path.join(OUTPUT_DIR, 'fBonificacao.csv'), index=False, encoding='utf-8-sig')
print(f"Saved fBonificacao.csv ({len(fBonificacao)} rows)")

print("\n==========================================")
print("=== REFINED ETL ANONYMIZATION SUCCESSFULLY COMPLETED! ===")
print("==========================================")
