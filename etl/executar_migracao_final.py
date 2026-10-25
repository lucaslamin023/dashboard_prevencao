import os
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pymongo
from dotenv import load_dotenv

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / "dashboard" / "server" / ".env")

mongo_url = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI")
if not mongo_url:
    print("ERRO: MONGO_URL não encontrada no .env!")
    sys.exit(1)

client = pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=20000)
db = client.get_database()
if db.name in ['test', 'admin', '']:
    db = client['prevencao_perdas']

print(f"✓ Conectado ao MongoDB: {db.name}")

data_dir = Path(__file__).resolve().parent.parent / "Dados_Consolidados"
if not data_dir.exists():
    data_dir = Path(__file__).resolve().parent.parent / "Dados_Anonimizados"

print(f"✓ Diretório de dados: {data_dir}")

def inserir_em_lotes(col, docs, chunk_size=10000, nome="coleção"):
    total = len(docs)
    if total == 0:
        return
    for i in range(0, total, chunk_size):
        chunk = docs[i:i + chunk_size]
        col.insert_many(chunk, ordered=False)
        print(f"  [{nome}] {min(i + chunk_size, total):,}/{total:,} inseridos...")

# 1. Carrega Metadados
print("\n[1/6] Carregando metadados de Filial, Produtos e Vendedores...")
df_filial = pd.read_csv(data_dir / "dFilial.csv")
map_geo = {
    'Centro-Oeste': 'Brasil - Centro-Oeste',
    'Norte': 'Brasil - Norte',
    'Nordeste': 'Brasil - Nordeste',
    'Sudeste': 'Brasil - Sudeste',
    'Sul': 'Brasil - Sul',
}
map_filial = {}
for _, row in df_filial.iterrows():
    f_id = int(row['Filial'])
    reg = str(row.get('Regiao', ''))
    if reg in map_geo:
        reg = map_geo[reg]
    elif not reg.startswith('Brasil - '):
        reg = f"Brasil - {reg}"
    map_filial[f_id] = {
        'Nome_Filial': str(row.get('Nome_Filial', f'Filial {f_id}')),
        'Regiao': reg,
        'Estado': str(row.get('Estado', '')),
        'Supervisor': str(row.get('Supervisor', 'N/A')),
    }

df_vendedores = pd.read_csv(data_dir / "dVendedores.csv")
map_vendedor = df_vendedores.set_index('ID_Vendedor')['Nome_Vendedor'].to_dict()

df_prod = pd.read_csv(data_dir / "dProdutos.csv", low_memory=False)
map_prod_cat = df_prod.set_index('Codigo_Produto')['Categoria'].to_dict()
map_prod_comp = df_prod.set_index('Codigo_Produto')['Comprador'].to_dict()
map_prod_nome = df_prod.set_index('Codigo_Produto')['Nome_Produto'].to_dict()
map_prod_custo = df_prod.set_index('Codigo_Produto')['Custo_Referencia'].to_dict()
map_prod_grupo = df_prod.set_index('Codigo_Produto')['Grupo'].to_dict()

# Libera espaço inicial caso necessário
print("\n[2/6] Limpando coleções para garantir quota livre no Atlas M0...")
db.cubo_mensal.drop()
db.cubo_mensal_av.drop()
db.vendas_av.drop()
db.inventarios.drop()
db.inventario_divergencias_categoria.drop()
db.inventario_top_produtos.drop()
print("  ✓ Coleções intermediárias limpas com sucesso.")

# 3. Recriar cubo_mensal (Visão Geral - ~42k docs) e cubo_mensal_av (Com Categoria - ~74k docs)
print("\n[3/6] Processando cubo_mensal e cubo_mensal_av...")
df_vendas = pd.read_csv(data_dir / "fVendas.csv")
df_perdas = pd.read_csv(data_dir / "fPerdasTotais.csv")

df_vendas['Ano_Mes'] = df_vendas['Data_Venda'].astype(str).str[:7]
df_perdas['Ano_Mes'] = df_perdas['Emissao_Data'].astype(str).str[:7]

df_vendas['Categoria'] = df_vendas['Codigo_Produto'].map(map_prod_cat).fillna('OUTROS')
df_vendas['Comprador'] = df_vendas['Codigo_Produto'].map(map_prod_comp).fillna('OUTROS')
df_vendas['Custo_Ref'] = df_vendas['Codigo_Produto'].map(map_prod_custo).fillna(0.0)

df_perdas['Categoria'] = df_perdas['Codigo_Produto'].map(map_prod_cat).fillna('OUTROS')
df_perdas['Comprador'] = df_perdas['Codigo_Produto'].map(map_prod_comp).fillna('OUTROS')

df_vendas['Fat_AV'] = np.where(df_vendas['Is_Venda_AV'] == 1, df_vendas['Valor_Total'], 0.0)
df_vendas['Qtd_AV'] = np.where(df_vendas['Is_Venda_AV'] == 1, df_vendas['Quantidade_Vendida'], 0)
df_vendas['Is_Abaixo_Custo'] = np.where(
    (df_vendas['Is_Venda_AV'] == 1) & (df_vendas['Valor_Unitario'] < df_vendas['Custo_Ref']),
    1, 0
)
df_vendas['Valor_Abaixo_Custo'] = np.where(
    df_vendas['Is_Abaixo_Custo'] == 1,
    df_vendas['Valor_Total'], 0.0
)

df_perdas['Perda_Venc'] = np.where(df_perdas['Motivo_Perda'] == 'VENCIMENTO', df_perdas['Valor_Perda'], 0.0)

# 3.1 CUBO MENSAL GERAL (Ano_Mes, Filial, Comprador) - ~42k docs
v_geral = df_vendas.groupby(['Ano_Mes', 'Filial', 'Comprador']).agg(
    faturamento=('Valor_Total', 'sum'),
    faturamento_av=('Fat_AV', 'sum'),
    qtd_vendida=('Quantidade_Vendida', 'sum')
).reset_index()

p_geral = df_perdas.groupby(['Ano_Mes', 'Filial', 'Comprador']).agg(
    perda_valor=('Valor_Perda', 'sum'),
    perda_vencimento=('Perda_Venc', 'sum'),
    perda_qtd=('Quantidade', 'sum')
).reset_index()

df_m_geral = pd.merge(v_geral, p_geral, on=['Ano_Mes', 'Filial', 'Comprador'], how='outer').fillna(0.0)
df_m_geral['faturamento'] = np.round(df_m_geral['faturamento'] * 2.1, 2)
df_m_geral['faturamento_av'] = np.round(df_m_geral['faturamento_av'] * 2.1, 2)
df_m_geral['perda_valor'] = np.round(df_m_geral['perda_valor'], 2)
df_m_geral['perda_vencimento'] = np.round(df_m_geral['perda_vencimento'], 2)
df_m_geral['total_av'] = np.round(df_m_geral['faturamento_av'] + df_m_geral['perda_vencimento'], 2)
df_m_geral['Regiao'] = df_m_geral['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_m_geral['Estado'] = df_m_geral['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))
df_m_geral['Nome_Filial'] = df_m_geral['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))

docs_cubo_m = df_m_geral.to_dict(orient='records')
inserir_em_lotes(db['cubo_mensal'], docs_cubo_m, chunk_size=15000, nome="cubo_mensal")
db['cubo_mensal'].create_index([('Ano_Mes', pymongo.ASCENDING)])
db['cubo_mensal'].create_index([('Filial', pymongo.ASCENDING)])
db['cubo_mensal'].create_index([('Comprador', pymongo.ASCENDING)])
db['cubo_mensal'].create_index([('Regiao', pymongo.ASCENDING), ('Estado', pymongo.ASCENDING)])
print(f"  ✓ cubo_mensal gravado: {len(docs_cubo_m):,} documentos.")

# 3.2 NOVA TABELA: cubo_mensal_av (Ano_Mes, Filial, Categoria, Comprador) - ~74k docs
v_av = df_vendas[df_vendas['Is_Venda_AV'] == 1].groupby(['Ano_Mes', 'Filial', 'Categoria', 'Comprador']).agg(
    faturamento_av=('Valor_Total', 'sum'),
    qtd_vendida_av=('Quantidade_Vendida', 'sum'),
    qtd_abaixo_custo=('Is_Abaixo_Custo', 'sum'),
    valor_abaixo_custo=('Valor_Abaixo_Custo', 'sum'),
    venda_av_transacoes=('Is_Venda_AV', 'count')
).reset_index()

p_av = df_perdas[df_perdas['Motivo_Perda'] == 'VENCIMENTO'].groupby(['Ano_Mes', 'Filial', 'Categoria', 'Comprador']).agg(
    perda_vencimento=('Valor_Perda', 'sum'),
    perda_qtd_vencimento=('Quantidade', 'sum')
).reset_index()

df_m_av = pd.merge(v_av, p_av, on=['Ano_Mes', 'Filial', 'Categoria', 'Comprador'], how='outer').fillna(0.0)
df_m_av['faturamento_av'] = np.round(df_m_av['faturamento_av'] * 2.1, 2)
df_m_av['valor_abaixo_custo'] = np.round(df_m_av['valor_abaixo_custo'] * 2.1, 2)
df_m_av['perda_vencimento'] = np.round(df_m_av['perda_vencimento'], 2)
df_m_av['total_av'] = np.round(df_m_av['faturamento_av'] + df_m_av['perda_vencimento'], 2)
df_m_av['Regiao'] = df_m_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_m_av['Estado'] = df_m_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))
df_m_av['Nome_Filial'] = df_m_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))

docs_cubo_av = df_m_av.to_dict(orient='records')
inserir_em_lotes(db['cubo_mensal_av'], docs_cubo_av, chunk_size=15000, nome="cubo_mensal_av")
db['cubo_mensal_av'].create_index([('Ano_Mes', pymongo.ASCENDING)])
db['cubo_mensal_av'].create_index([('Filial', pymongo.ASCENDING)])
db['cubo_mensal_av'].create_index([('Categoria', pymongo.ASCENDING)])
db['cubo_mensal_av'].create_index([('Comprador', pymongo.ASCENDING)])
db['cubo_mensal_av'].create_index([('Regiao', pymongo.ASCENDING), ('Estado', pymongo.ASCENDING)])
print(f"  ✓ nova tabela cubo_mensal_av gravada: {len(docs_cubo_av):,} documentos.")

# 4. Criar coleção vendas_av (50.000 transações de produtos a vencer)
print("\n[4/6] Carregando e estruturando coleção vendas_av...")
df_vendas_av = df_vendas[df_vendas['Is_Venda_AV'] == 1].copy()
df_vendas_av['Nome_Vendedor'] = df_vendas_av['ID_Vendedor'].map(map_vendedor).fillna('Vendedor Não Identificado')
df_vendas_av['Nome_Produto'] = df_vendas_av['Codigo_Produto'].map(map_prod_nome).fillna('Produto')
df_vendas_av['Grupo'] = df_vendas_av['Codigo_Produto'].map(map_prod_grupo).fillna('Outros')
df_vendas_av['Nome_Filial'] = df_vendas_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))
df_vendas_av['Regiao'] = df_vendas_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_vendas_av['Estado'] = df_vendas_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))
df_vendas_av['Supervisor'] = df_vendas_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Supervisor', ''))

df_vendas_av['Valor_Total'] = np.round(df_vendas_av['Valor_Total'] * 2.1, 2)
df_vendas_av['Valor_Unitario'] = np.round(df_vendas_av['Valor_Unitario'] * 2.1, 2)
df_vendas_av['Custo_Total'] = np.round(df_vendas_av['Quantidade_Vendida'] * df_vendas_av['Custo_Ref'], 2)
df_vendas_av['Is_Abaixo_Custo'] = (df_vendas_av['Valor_Unitario'] < df_vendas_av['Custo_Ref']).astype(int)
df_vendas_av['Desagio_Valor'] = np.where(
    df_vendas_av['Is_Abaixo_Custo'] == 1,
    np.round((df_vendas_av['Custo_Ref'] - df_vendas_av['Valor_Unitario']) * df_vendas_av['Quantidade_Vendida'], 2),
    0.0
)
df_vendas_av['Margem_Perc'] = np.where(
    df_vendas_av['Valor_Total'] > 0,
    np.round(((df_vendas_av['Valor_Total'] - df_vendas_av['Custo_Total']) / df_vendas_av['Valor_Total']) * 100, 2),
    0.0
)

cols_vendas_av = [
    'ID_Venda', 'Data_Venda', 'Ano_Mes', 'Filial', 'Nome_Filial', 'Regiao', 'Estado',
    'ID_Vendedor', 'Nome_Vendedor', 'Codigo_Produto', 'Nome_Produto', 'Categoria', 'Comprador',
    'Quantidade_Vendida', 'Valor_Unitario', 'Valor_Total', 'Custo_Ref', 'Is_Abaixo_Custo',
    'Desagio_Valor', 'Margem_Perc'
]
df_vendas_av_sub = df_vendas_av[cols_vendas_av]

docs_vendas_av = df_vendas_av_sub.to_dict(orient='records')
inserir_em_lotes(db['vendas_av'], docs_vendas_av, chunk_size=15000, nome="vendas_av")
db['vendas_av'].create_index([('Ano_Mes', pymongo.ASCENDING)])
db['vendas_av'].create_index([('Data_Venda', pymongo.ASCENDING)])
db['vendas_av'].create_index([('Filial', pymongo.ASCENDING)])
db['vendas_av'].create_index([('ID_Vendedor', pymongo.ASCENDING)])
db['vendas_av'].create_index([('Categoria', pymongo.ASCENDING)])
print(f"  ✓ vendas_av carregada: {len(docs_vendas_av):,} documentos.")

# 5. Carregar inventários e sumários de divergência
print("\n[5/6] Carregando acompanhamento de inventários (fResultadoInventario.csv)...")
df_inv_res = pd.read_csv(data_dir / "fResultadoInventario.csv")
df_inv_res['Filial'] = df_inv_res['Filial'].astype(int)
df_inv_res['Nome_Filial'] = df_inv_res['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))
df_inv_res['Regiao'] = df_inv_res['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_inv_res['Estado'] = df_inv_res['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))
df_inv_res['Supervisor'] = df_inv_res['Filial'].map(lambda f: map_filial.get(f, {}).get('Supervisor', ''))
df_inv_res['Ano_Mes'] = df_inv_res['Data'].astype(str).str[:7]

df_inv_res['Diferenca_Liquida'] = np.round(df_inv_res['Valor_Sobra'] - df_inv_res['Valor_Falta'], 2)
df_inv_res['Perc_Diferenca'] = np.round(df_inv_res['Resultado_Perc_Diferenca_Estoque_Anterior'] * 100, 4)
df_inv_res['Acuracidade_Perc'] = np.round(np.clip(100.0 - np.abs(df_inv_res['Perc_Diferenca']), 0, 100), 2)

conditions = [
    df_inv_res['Acuracidade_Perc'] >= 99.50,
    df_inv_res['Acuracidade_Perc'] >= 99.00,
]
choices = ['Dentro da Meta', 'Atenção']
df_inv_res['Status_Acuracidade'] = np.select(conditions, choices, default='Urgente')

docs_inv = df_inv_res.to_dict(orient='records')
inserir_em_lotes(db['inventarios'], docs_inv, chunk_size=5000, nome="inventarios")
db['inventarios'].create_index([('Filial', pymongo.ASCENDING)])
db['inventarios'].create_index([('Data', pymongo.DESCENDING)])
db['inventarios'].create_index([('Ano_Mes', pymongo.ASCENDING)])
db['inventarios'].create_index([('Status_Acuracidade', pymongo.ASCENDING)])
print(f"  ✓ inventarios carregada: {len(docs_inv):,} documentos.")

# 5.1 Sumários de divergência
print("  - Processando sumários de divergência...")
df_div = pd.read_csv(data_dir / "fDivergenciasInventario.csv")
df_div['Filial'] = df_div['Filial'].astype(int)
df_div['Codigo_Produto'] = df_div['Codigo_Produto'].astype(int)
df_div['Ano_Mes'] = df_div['Data'].astype(str).str[:7]
df_div['Nome_Produto'] = df_div['Codigo_Produto'].map(map_prod_nome).fillna('Produto')
df_div['Categoria'] = df_div['Codigo_Produto'].map(map_prod_cat).fillna('OUTROS')
df_div['Nome_Filial'] = df_div['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))
df_div['Regiao'] = df_div['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_div['Estado'] = df_div['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))

map_tipo_div = {
    'DIVERGNCIA LOTE': 'Divergência de Lote',
    'Divergência Lote': 'Divergência de Lote',
    'CADASTRO INVERTIDO': 'Cadastro Invertido',
    'FALTA': 'Falta',
    'SOBRA': 'Sobra',
}
df_div['Tipo_Divergencia'] = df_div['Tipo_Divergencia'].map(lambda t: map_tipo_div.get(t, str(t).title()))

df_div_cat = df_div.groupby(['Categoria', 'Tipo_Divergencia']).agg(
    total_itens=('Codigo_Produto', 'count'),
    qtd_divergente=('Diferenca_Qtd', 'sum'),
    valor_divergente=('Diferenca_Real_Valor', 'sum')
).reset_index()
df_div_cat['valor_divergente'] = np.round(df_div_cat['valor_divergente'], 2)

docs_div_cat = df_div_cat.to_dict(orient='records')
db['inventario_divergencias_categoria'].insert_many(docs_div_cat)

df_top_prod = df_div.groupby(['Codigo_Produto', 'Nome_Produto', 'Categoria']).agg(
    total_ocorrencias=('Filial', 'count'),
    qtd_total_divergencia=('Diferenca_Qtd', 'sum'),
    valor_total_divergencia=('Diferenca_Real_Valor', 'sum')
).reset_index().sort_values(by='valor_total_divergencia', ascending=False).head(500)
df_top_prod['valor_total_divergencia'] = np.round(df_top_prod['valor_total_divergencia'], 2)

docs_top_prod = df_top_prod.to_dict(orient='records')
db['inventario_top_produtos'].insert_many(docs_top_prod)
print(f"  ✓ sumários de divergência carregados ({len(docs_div_cat)} categorias, {len(docs_top_prod)} top produtos).")

# 6. Recarregar indicadores otimizados (apenas 26 colunas essenciais, liberando mais de 200MB de espaço)
print("\n[6/6] Otimizando coleção indicadores (removendo 30 colunas de features brutas não utilizadas)...")
# Lemos do CSV original com limite de 200.581 linhas para manter a base consistente
cols_indicadores = [
    'Filial', 'Codigo_Produto', 'Nome_Produto', 'Categoria', 'Comprador', 'Grupo', 'Principio_Ativo',
    'Estoque_Atual', 'Demanda_Atual', 'Demanda_Ponderada', 'Demanda_Rede', 'Dias_Cobertura', 'Status_Ruptura',
    'Valor_Estoque_Custo', 'Valor_Excesso_Custo', 'Nivel_Excesso', 'Qtd_Estoque_Excesso',
    'Score_Risco_Perda_ML', 'Categoria_Risco_Perda', 'Valor_AV', 'Qtd_AV',
    'Score_Auditoria', 'Classificacao_Risco_Auditoria', 'Acao_Recomendada', 'Prazo_Validade_Meses'
]
df_ind = pd.read_csv(data_dir / "fIndicadores_ML.csv", nrows=200581, usecols=cols_indicadores, low_memory=False)

df_ind['Nome_Filial'] = df_ind['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))
df_ind['Regiao'] = df_ind['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_ind['Estado'] = df_ind['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))
df_ind['Supervisor'] = df_ind['Filial'].map(lambda f: map_filial.get(f, {}).get('Supervisor', ''))

# Reclassificar ações de auditoria (remover 'sem validade informada')
mask_sem_val = df_ind['Acao_Recomendada'].str.contains('validade', case=False, na=True) | df_ind['Acao_Recomendada'].isna() | (df_ind['Acao_Recomendada'] == '')

# Regras práticas de auditoria para produtos críticos
cond_reposicionar = mask_sem_val & (df_ind['Demanda_Atual'] > 0)
cond_transferir_sku = mask_sem_val & (df_ind['Demanda_Atual'] <= 0) & (df_ind['Demanda_Rede'] > 0)
cond_vender_custo = mask_sem_val & ((df_ind['Score_Auditoria'] >= 0.70) | (df_ind['Dias_Cobertura'] > 45))
cond_cotacao = mask_sem_val & (df_ind['Demanda_Atual'] <= 0) & (df_ind['Demanda_Rede'] <= 0)

df_ind['Acao_Recomendada'] = np.select(
    [cond_vender_custo, cond_transferir_sku, cond_reposicionar, cond_cotacao],
    [
        'Produto crítico: vender abaixo do custo (última prioridade)',
        'Transferir para filial/loja com demanda do SKU',
        'Reposicionar e priorizar venda / Filial acompanhar a saída do produto',
        'Cotação do produto no mercado e avaliar ajuste de preço'
    ],
    default=df_ind['Acao_Recomendada']
)

# Caso ainda reste alguma sem validade
df_ind['Acao_Recomendada'] = df_ind['Acao_Recomendada'].replace({
    'Produto sem validade informada: solicitar à filial o cadastro': 'Igualar a apresentação genérica mais vendida; posicionar o produto acima ou à frente',
    'Produto sem validade informada: solicitar  filial o cadastro': 'Igualar a apresentação genérica mais vendida; posicionar o produto acima ou à frente'
})

# Padronizar ortografia UTF-8
map_ortografia = {
    "Produto crtico: vender abaixo do custo (ltima prioridade)": "Produto crítico: vender abaixo do custo (última prioridade)",
    "Reposicionar e priorizar venda / Filial acompanhar a sada do produto": "Reposicionar e priorizar venda / Filial acompanhar a saída do produto",
    "Transferir para filial/loja com demanda do princpio ativo": "Transferir para filial/loja com demanda do princípio ativo",
    "Igualar a apresentao genrica mais vendida; posicionar o produto acima ou  frente / Filial acompanhar": "Igualar a apresentação genérica mais vendida; posicionar o produto acima ou à frente",
    "Cotao do produto no mercado e avaliar ajuste de preo": "Cotação do produto no mercado e avaliar ajuste de preço",
    "O comprador deve comunicar os mdicos para gerar prescrio mdica e bloquear a compra do produto": "O comprador deve comunicar os médicos para gerar prescrição médica e bloquear compra",
    "Acionar Inteligncia de Mercado ou representante do fabricante": "Acionar Inteligência de Mercado ou representante do fabricante",
}
df_ind['Acao_Recomendada'] = df_ind['Acao_Recomendada'].replace(map_ortografia)

# Padronizar Status_Ruptura UTF-8
df_ind['Status_Ruptura'] = df_ind['Status_Ruptura'].replace({
    'Crtico / Alto Risco': 'Crítico / Alto Risco',
    'Crtico / Alto Risco': 'Crítico / Alto Risco'
})
# Padronizar Categoria_Risco_Perda UTF-8
df_ind['Categoria_Risco_Perda'] = df_ind['Categoria_Risco_Perda'].replace({
    'Crtico': 'Crítico', 'Crtico': 'Crítico',
    'Mdio': 'Médio', 'Mdio': 'Médio'
})

# Agora substituímos a coleção indicadores com a versão compacta e corrigida
db.indicadores.drop()
docs_ind = df_ind.to_dict(orient='records')
inserir_em_lotes(db['indicadores'], docs_ind, chunk_size=15000, nome="indicadores")

db['indicadores'].create_index([('Filial', pymongo.ASCENDING)])
db['indicadores'].create_index([('Codigo_Produto', pymongo.ASCENDING)])
db['indicadores'].create_index([('Status_Ruptura', pymongo.ASCENDING)])
db['indicadores'].create_index([('Categoria_Risco_Perda', pymongo.ASCENDING)])
db['indicadores'].create_index([('Score_Auditoria', pymongo.DESCENDING)])
db['indicadores'].create_index([('Score_Risco_Perda_ML', pymongo.DESCENDING)])
db['indicadores'].create_index([('Valor_AV', pymongo.DESCENDING)])
print(f"  ✓ coleção indicadores otimizada e reindexada: {len(docs_ind):,} documentos.")

# Recalcular cubo_acoes a partir do novo indicadores
print("  - Recalculando coleção cubo_acoes...")
db.cubo_acoes.drop()
pipeline_cubo_acoes = [
    {"$match": {"Acao_Recomendada": {"$nin": [None, ""]}}},
    {
        "$group": {
            "_id": {
                "Filial": "$Filial",
                "Categoria": "$Categoria",
                "Comprador": "$Comprador",
                "Acao_Recomendada": "$Acao_Recomendada",
                "Regiao": "$Regiao",
                "Estado": "$Estado",
            },
            "n": {"$sum": 1}
        }
    },
    {
        "$project": {
            "_id": 0,
            "Filial": "$_id.Filial",
            "Categoria": "$_id.Categoria",
            "Comprador": "$_id.Comprador",
            "Acao_Recomendada": "$_id.Acao_Recomendada",
            "Regiao": "$_id.Regiao",
            "Estado": "$_id.Estado",
            "n": 1
        }
    }
]
acoes_agg = list(db.indicadores.aggregate(pipeline_cubo_acoes))
inserir_em_lotes(db['cubo_acoes'], acoes_agg, chunk_size=15000, nome="cubo_acoes")
db['cubo_acoes'].create_index([('Filial', pymongo.ASCENDING)])
db['cubo_acoes'].create_index([('Categoria', pymongo.ASCENDING)])
db['cubo_acoes'].create_index([('Comprador', pymongo.ASCENDING)])
db['cubo_acoes'].create_index([('Acao_Recomendada', pymongo.ASCENDING)])
print(f"  ✓ cubo_acoes recriado com {len(acoes_agg):,} documentos.")

print("\n=======================================================")
print("✓ Migração final concluída com 100% de sucesso!")
print("=======================================================")
