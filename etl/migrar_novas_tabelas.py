import os
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pymongo
from dotenv import load_dotenv

# Configura encoding stdout para Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Carrega variáveis de ambiente
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

# 1. Carrega Metadados de Filial e Produtos para Enriquecimento
print("\n[1/5] Carregando metadados de Filial, Produtos e Vendedores...")
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

print(f"  ✓ {len(map_filial)} filiais, {len(map_vendedor)} vendedores, {len(map_prod_cat)} produtos mapeados.")

# 2. Recriar cubo_mensal com Categoria e métricas AV
print("\n[2/5] Processando e reconstruindo cubo_mensal (com Categoria e métricas AV)...")
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
df_perdas['Perda_Venc_Qtd'] = np.where(df_perdas['Motivo_Perda'] == 'VENCIMENTO', df_perdas['Quantidade'], 0)

v_agg = df_vendas.groupby(['Ano_Mes', 'Filial', 'Categoria', 'Comprador']).agg(
    faturamento=('Valor_Total', 'sum'),
    faturamento_av=('Fat_AV', 'sum'),
    qtd_vendida=('Quantidade_Vendida', 'sum'),
    qtd_vendida_av=('Qtd_AV', 'sum'),
    qtd_abaixo_custo=('Is_Abaixo_Custo', 'sum'),
    valor_abaixo_custo=('Valor_Abaixo_Custo', 'sum'),
    venda_av_transacoes=('Is_Venda_AV', 'sum')
).reset_index()

p_agg = df_perdas.groupby(['Ano_Mes', 'Filial', 'Categoria', 'Comprador']).agg(
    perda_valor=('Valor_Perda', 'sum'),
    perda_vencimento=('Perda_Venc', 'sum'),
    perda_qtd=('Quantidade', 'sum'),
    perda_qtd_vencimento=('Perda_Venc_Qtd', 'sum')
).reset_index()

df_cubo_m = pd.merge(v_agg, p_agg, on=['Ano_Mes', 'Filial', 'Categoria', 'Comprador'], how='outer').fillna(0.0)

# Multiplicador 2.1x no faturamento (inflar 110%)
df_cubo_m['faturamento'] = np.round(df_cubo_m['faturamento'] * 2.1, 2)
df_cubo_m['faturamento_av'] = np.round(df_cubo_m['faturamento_av'] * 2.1, 2)
df_cubo_m['valor_abaixo_custo'] = np.round(df_cubo_m['valor_abaixo_custo'] * 2.1, 2)
df_cubo_m['perda_valor'] = np.round(df_cubo_m['perda_valor'], 2)
df_cubo_m['perda_vencimento'] = np.round(df_cubo_m['perda_vencimento'], 2)

# Total A Vencer no Mês = Faturamento AV + Perda por Vencimento
df_cubo_m['total_av'] = np.round(df_cubo_m['faturamento_av'] + df_cubo_m['perda_vencimento'], 2)

# Enriquecer com Geografia
df_cubo_m['Regiao'] = df_cubo_m['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_cubo_m['Estado'] = df_cubo_m['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))
df_cubo_m['Nome_Filial'] = df_cubo_m['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))

docs_cubo_m = df_cubo_m.to_dict(orient='records')
db['cubo_mensal'].drop()
inserir_em_lotes(db['cubo_mensal'], docs_cubo_m, chunk_size=15000, nome="cubo_mensal")
db['cubo_mensal'].create_index([('Ano_Mes', pymongo.ASCENDING)])
db['cubo_mensal'].create_index([('Filial', pymongo.ASCENDING)])
db['cubo_mensal'].create_index([('Categoria', pymongo.ASCENDING)])
db['cubo_mensal'].create_index([('Comprador', pymongo.ASCENDING)])
db['cubo_mensal'].create_index([('Regiao', pymongo.ASCENDING), ('Estado', pymongo.ASCENDING)])
print(f"  ✓ cubo_mensal reconstruído com sucesso: {len(docs_cubo_m):,} documentos.")

# 3. Criar coleção vendas_av (50.000 transações de produtos a vencer)
print("\n[3/5] Carregando e estruturando coleção vendas_av...")
df_vendas_av = df_vendas[df_vendas['Is_Venda_AV'] == 1].copy()
df_vendas_av['Nome_Vendedor'] = df_vendas_av['ID_Vendedor'].map(map_vendedor).fillna('Vendedor Não Identificado')
df_vendas_av['Nome_Produto'] = df_vendas_av['Codigo_Produto'].map(map_prod_nome).fillna('Produto')
df_vendas_av['Grupo'] = df_vendas_av['Codigo_Produto'].map(map_prod_grupo).fillna('Outros')
df_vendas_av['Nome_Filial'] = df_vendas_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))
df_vendas_av['Regiao'] = df_vendas_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_vendas_av['Estado'] = df_vendas_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))
df_vendas_av['Supervisor'] = df_vendas_av['Filial'].map(lambda f: map_filial.get(f, {}).get('Supervisor', ''))

# Ajuste 2.1x no valor da venda
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

docs_vendas_av = df_vendas_av.to_dict(orient='records')
db['vendas_av'].drop()
inserir_em_lotes(db['vendas_av'], docs_vendas_av, chunk_size=15000, nome="vendas_av")
db['vendas_av'].create_index([('Ano_Mes', pymongo.ASCENDING)])
db['vendas_av'].create_index([('Data_Venda', pymongo.ASCENDING)])
db['vendas_av'].create_index([('Filial', pymongo.ASCENDING)])
db['vendas_av'].create_index([('ID_Vendedor', pymongo.ASCENDING)])
db['vendas_av'].create_index([('Categoria', pymongo.ASCENDING)])
db['vendas_av'].create_index([('Comprador', pymongo.ASCENDING)])
db['vendas_av'].create_index([('Regiao', pymongo.ASCENDING), ('Estado', pymongo.ASCENDING)])
print(f"  ✓ vendas_av carregada: {len(docs_vendas_av):,} documentos.")

# 4. Carregar inventários e divergências
print("\n[4/5] Processando acompanhamento de inventários e acuracidade de estoque...")
df_inv_res = pd.read_csv(data_dir / "fResultadoInventario.csv")
df_inv_res['Filial'] = df_inv_res['Filial'].astype(int)
df_inv_res['Nome_Filial'] = df_inv_res['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))
df_inv_res['Regiao'] = df_inv_res['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_inv_res['Estado'] = df_inv_res['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))
df_inv_res['Supervisor'] = df_inv_res['Filial'].map(lambda f: map_filial.get(f, {}).get('Supervisor', ''))
df_inv_res['Ano_Mes'] = df_inv_res['Data'].astype(str).str[:7]

# Cálculo de acuracidade: 100% - |Diferença % em relação ao estoque anterior|
# Diferença líquida = Valor_Sobra - Valor_Falta
df_inv_res['Diferenca_Liquida'] = np.round(df_inv_res['Valor_Sobra'] - df_inv_res['Valor_Falta'], 2)
df_inv_res['Perc_Diferenca'] = np.round(df_inv_res['Resultado_Perc_Diferenca_Estoque_Anterior'] * 100, 4)
df_inv_res['Acuracidade_Perc'] = np.round(np.clip(100.0 - np.abs(df_inv_res['Perc_Diferenca']), 0, 100), 2)

# Tag Status:
# >= 99.50% -> 'Dentro da Meta'
# 99.00% a 99.49% -> 'Atenção'
# < 99.00% -> 'Urgente'
conditions = [
    df_inv_res['Acuracidade_Perc'] >= 99.50,
    df_inv_res['Acuracidade_Perc'] >= 99.00,
]
choices = ['Dentro da Meta', 'Atenção']
df_inv_res['Status_Acuracidade'] = np.select(conditions, choices, default='Urgente')

docs_inv = df_inv_res.to_dict(orient='records')
db['inventarios'].drop()
inserir_em_lotes(db['inventarios'], docs_inv, chunk_size=5000, nome="inventarios")
db['inventarios'].create_index([('Filial', pymongo.ASCENDING)])
db['inventarios'].create_index([('Data', pymongo.DESCENDING)])
db['inventarios'].create_index([('Ano_Mes', pymongo.ASCENDING)])
db['inventarios'].create_index([('Status_Acuracidade', pymongo.ASCENDING)])
print(f"  ✓ inventarios carregada: {len(docs_inv):,} documentos.")

# 4.2 Divergências detalhadas e cubos agregados
print("  - Processando fDivergenciasInventario.csv...")
df_div = pd.read_csv(data_dir / "fDivergenciasInventario.csv")
df_div['Filial'] = df_div['Filial'].astype(int)
df_div['Codigo_Produto'] = df_div['Codigo_Produto'].astype(int)
df_div['Ano_Mes'] = df_div['Data'].astype(str).str[:7]
df_div['Nome_Produto'] = df_div['Codigo_Produto'].map(map_prod_nome).fillna('Produto')
df_div['Categoria'] = df_div['Codigo_Produto'].map(map_prod_cat).fillna('OUTROS')
df_div['Comprador'] = df_div['Codigo_Produto'].map(map_prod_comp).fillna('OUTROS')
df_div['Nome_Filial'] = df_div['Filial'].map(lambda f: map_filial.get(f, {}).get('Nome_Filial', ''))
df_div['Regiao'] = df_div['Filial'].map(lambda f: map_filial.get(f, {}).get('Regiao', ''))
df_div['Estado'] = df_div['Filial'].map(lambda f: map_filial.get(f, {}).get('Estado', ''))

# Normalização de tipos de divergência
map_tipo_div = {
    'DIVERGNCIA LOTE': 'Divergência de Lote',
    'Divergência Lote': 'Divergência de Lote',
    'CADASTRO INVERTIDO': 'Cadastro Invertido',
    'FALTA': 'Falta',
    'SOBRA': 'Sobra',
}
df_div['Tipo_Divergencia'] = df_div['Tipo_Divergencia'].map(lambda t: map_tipo_div.get(t, str(t).title()))

# Cria coleção sumarizada de divergências por Categoria e Tipo para gráficos instantâneos
df_div_cat = df_div.groupby(['Categoria', 'Tipo_Divergencia']).agg(
    total_itens=('Codigo_Produto', 'count'),
    qtd_divergente=('Diferenca_Qtd', 'sum'),
    valor_divergente=('Diferenca_Real_Valor', 'sum')
).reset_index()
df_div_cat['valor_divergente'] = np.round(df_div_cat['valor_divergente'], 2)

docs_div_cat = df_div_cat.to_dict(orient='records')
db['inventario_divergencias_categoria'].drop()
db['inventario_divergencias_categoria'].insert_many(docs_div_cat)
print(f"  ✓ inventario_divergencias_categoria criada com {len(docs_div_cat)} registros.")

# Top produtos com divergência
df_top_prod = df_div.groupby(['Codigo_Produto', 'Nome_Produto', 'Categoria']).agg(
    total_ocorrencias=('Filial', 'count'),
    qtd_total_divergencia=('Diferenca_Qtd', 'sum'),
    valor_total_divergencia=('Diferenca_Real_Valor', 'sum')
).reset_index().sort_values(by='valor_total_divergencia', ascending=False).head(500)
df_top_prod['valor_total_divergencia'] = np.round(df_top_prod['valor_total_divergencia'], 2)

docs_top_prod = df_top_prod.to_dict(orient='records')
db['inventario_top_produtos'].drop()
db['inventario_top_produtos'].insert_many(docs_top_prod)
print(f"  ✓ inventario_top_produtos criada com {len(docs_top_prod)} registros.")

# 5. Ajustar Ações de Auditoria (remover 'sem validade informada' e atribuir ações práticas)
print("\n[5/5] Reclassificando ações de auditoria (removendo 'sem validade informada')...")

# Buscar todas as ações no indicadores que possuem 'sem validade' ou estão vazias/nulas
# Regras aplicadas para produtos críticos e alto risco:
# 1. Se Demanda_Atual > 0 -> 'Reposicionar e priorizar venda / Filial acompanhar a saída do produto'
# 2. Se Demanda_Atual == 0 e Demanda_Rede > 0 -> 'Transferir para filial/loja com demanda do SKU'
# 3. Se Dias_Cobertura > 45 ou Score_Auditoria >= 0.70 -> 'Produto crítico: vender abaixo do custo (última prioridade)'
# 4. Se Demanda_Atual == 0 e Demanda_Rede == 0 -> 'Cotação do produto no mercado e avaliar ajuste de preço'
# 5. Demais -> 'Igualar a apresentação genérica mais vendida; posicionar o produto acima ou à frente'

filtro_sem_validade = {
    "$or": [
        {"Acao_Recomendada": {"$regex": "validade", "$options": "i"}},
        {"Acao_Recomendada": None},
        {"Acao_Recomendada": ""},
    ]
}

res1 = db.indicadores.update_many(
    {**filtro_sem_validade, "Demanda_Atual": {"$gt": 0}},
    {"$set": {"Acao_Recomendada": "Reposicionar e priorizar venda / Filial acompanhar a saída do produto"}}
)
print(f"  - Reposicionar e priorizar venda: {res1.modified_count:,} produtos atualizados.")

res2 = db.indicadores.update_many(
    {**filtro_sem_validade, "Demanda_Atual": {"$lte": 0}, "Demanda_Rede": {"$gt": 0}},
    {"$set": {"Acao_Recomendada": "Transferir para filial/loja com demanda do SKU"}}
)
print(f"  - Transferir SKU para rede: {res2.modified_count:,} produtos atualizados.")

res3 = db.indicadores.update_many(
    {**filtro_sem_validade, "$or": [{"Score_Auditoria": {"$gte": 0.70}}, {"Dias_Cobertura": {"$gt": 45}}]},
    {"$set": {"Acao_Recomendada": "Produto crítico: vender abaixo do custo (última prioridade)"}}
)
print(f"  - Vender abaixo do custo: {res3.modified_count:,} produtos atualizados.")

res4 = db.indicadores.update_many(
    {**filtro_sem_validade, "Demanda_Atual": {"$lte": 0}, "Demanda_Rede": {"$lte": 0}},
    {"$set": {"Acao_Recomendada": "Cotação do produto no mercado e avaliar ajuste de preço"}}
)
print(f"  - Cotação no mercado: {res4.modified_count:,} produtos atualizados.")

res5 = db.indicadores.update_many(
    filtro_sem_validade,
    {"$set": {"Acao_Recomendada": "Igualar a apresentação genérica mais vendida; posicionar o produto acima ou à frente"}}
)
print(f"  - Apresentação genérica: {res5.modified_count:,} produtos atualizados.")

# Limpeza e padronização ortográfica UTF-8 de todas as ações restantes
map_ortografia = {
    "Produto crtico: vender abaixo do custo (ltima prioridade)": "Produto crítico: vender abaixo do custo (última prioridade)",
    "Reposicionar e priorizar venda / Filial acompanhar a sada do produto": "Reposicionar e priorizar venda / Filial acompanhar a saída do produto",
    "Transferir para filial/loja com demanda do princpio ativo": "Transferir para filial/loja com demanda do princípio ativo",
    "Igualar a apresentao genrica mais vendida; posicionar o produto acima ou  frente / Filial acompanhar": "Igualar a apresentação genérica mais vendida; posicionar o produto acima ou à frente",
    "Cotao do produto no mercado e avaliar ajuste de preo": "Cotação do produto no mercado e avaliar ajuste de preço",
    "O comprador deve comunicar os mdicos para gerar prescrio mdica e bloquear a compra do produto": "O comprador deve comunicar os médicos para gerar prescrição médica e bloquear compra",
    "Acionar Inteligncia de Mercado ou representante do fabricante": "Acionar Inteligência de Mercado ou representante do fabricante",
}
for k, v in map_ortografia.items():
    db.indicadores.update_many({"Acao_Recomendada": k}, {"$set": {"Acao_Recomendada": v}})

# Reconstruir cubo_acoes a partir dos novos indicadores atualizados
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
print(f"  ✓ cubo_acoes atualizado com {len(acoes_agg):,} documentos.")

print("\n=======================================================")
print("✓ Todas as coleções e tabelas foram criadas e atualizadas com sucesso!")
print("=======================================================")
