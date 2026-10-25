import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
import pymongo
from dotenv import load_dotenv

# Reconfigure stdout/stderr for UTF-8 on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.config import (
    DIR_CONSOLIDADOS,
    DATA_REFERENCIA,
    PESOS,
    PESO_CATEGORIA,
    TOTAL_FILIAIS,
)

# Load environment variables (.env in etl/ or root)
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def conectar_mongodb() -> pymongo.database.Database:
    mongo_url = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI")
    if not mongo_url:
        raise ValueError("Variável de ambiente MONGO_URL não configurada no arquivo .env!")

    client = pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=10000)
    # Testa conexão
    client.server_info()

    # Se a URL não tiver o nome do banco no path, usa 'prevencao_perdas'
    db = client.get_database()
    if db.name in ['test', 'admin', '']:
        db = client['prevencao_perdas']

    print(f"  ✓ Conectado ao MongoDB Atlas: {client.address[0]} (Database: {db.name})")
    return db


def inserir_em_lotes(collection: pymongo.collection.Collection, lista_docs: list, chunk_size: int = 10000, nome: str = ""):
    total = len(lista_docs)
    if total == 0:
        return
    for i in range(0, total, chunk_size):
        chunk = lista_docs[i:i + chunk_size]
        collection.insert_many(chunk, ordered=False)
        if nome:
            print(f"    - [{nome}] Inseridos {min(i + chunk_size, total):,} / {total:,} docs...", flush=True)


def carregar_dados_mongo(data_dir=DIR_CONSOLIDADOS, drop_first=True, apenas_relevantes=True):
    inicio_total = time.time()
    print("=" * 65)
    print("🚀 INICIANDO CARGA NO MONGODB ATLAS (FASE 3)")
    print(f"Diretório dos dados : {data_dir}")
    print(f"Data de Referência  : {DATA_REFERENCIA}")
    print("=" * 65)

    db = conectar_mongodb()

    if drop_first:
        print("\n[Limpando coleções existentes para carga idempotente...]")
        for col_name in ['meta', 'dFilial', 'indicadores', 'avencer', 'cubo', 'cubo_acoes', 'cubo_mensal']:
            db[col_name].drop()
            print(f"  - Coleção '{col_name}' resetada.")

    # =========================================================================
    # 1. dFilial
    # =========================================================================
    print("\n[1/6] Carregando dFilial...")
    df_filial = pd.read_csv(data_dir / "dFilial.csv")
    df_filial['Filial'] = df_filial['Filial'].astype(int)
    for c in ['Nome_Filial', 'Supervisor', 'Regiao', 'Estado', 'Pais']:
        if c in df_filial.columns:
            df_filial[c] = df_filial[c].fillna('').astype(str)

    # Padroniza regiões do Brasil como 'Brasil - Região'
    mapa_br = {'Centro-Oeste': 'Brasil - Centro-Oeste', 'Norte': 'Brasil - Norte', 'Nordeste': 'Brasil - Nordeste', 'Sudeste': 'Brasil - Sudeste', 'Sul': 'Brasil - Sul'}
    df_filial['Regiao'] = df_filial['Regiao'].replace(mapa_br)

    docs_filial = df_filial.to_dict(orient='records')
    db['dFilial'].insert_many(docs_filial)
    db['dFilial'].create_index([('Filial', pymongo.ASCENDING)], unique=True)
    print(f"  ✓ dFilial carregada: {len(docs_filial):,} documentos com índice único.")

    map_filial_geo = df_filial.set_index('Filial')[['Nome_Filial', 'Supervisor', 'Regiao', 'Estado', 'Pais']].to_dict(orient='index')

    # =========================================================================
    # 2. fAVencer
    # =========================================================================
    print("\n[2/6] Carregando avencer...")
    df_av = pd.read_csv(data_dir / "fAVencer.csv")
    df_av['Filial'] = df_av['Filial'].astype(int)
    df_av['Codigo_Produto'] = df_av['Codigo_Produto'].astype(int)
    df_av['ZJ1_ID'] = df_av['ZJ1_ID'].astype(int)
    df_av['Demanda'] = df_av['Demanda'].fillna(0).astype(int)
    df_av['Estoque'] = df_av['Estoque'].fillna(0).astype(int)
    df_av['Custo_Unitario'] = df_av['Custo_Unitario'].fillna(0.0).astype(float)
    df_av['Total_AV'] = df_av['Total_AV'].fillna(0.0).astype(float)
    df_av['Preco_Venda'] = df_av['Preco_Venda'].fillna(0.0).astype(float)
    df_av['EAN'] = df_av['EAN'].astype(str)
    df_av['ZJ1_Lote'] = df_av['ZJ1_Lote'].astype(str)
    df_av['Resolvido'] = df_av['Resolvido'].astype(str)
    df_av['Comprador'] = df_av['Comprador'].fillna('').astype(str)
    df_av['Fornecedor'] = df_av['Fornecedor'].fillna('').astype(str)
    df_av['Chave'] = df_av['Chave'].astype(str)

    docs_av = df_av.to_dict(orient='records')
    inserir_em_lotes(db['avencer'], docs_av, chunk_size=15000, nome="avencer")
    db['avencer'].create_index([('Filial', pymongo.ASCENDING), ('Codigo_Produto', pymongo.ASCENDING)])
    print(f"  ✓ avencer carregada: {len(docs_av):,} documentos.")

    # =========================================================================
    # 3. fIndicadores_ML -> cubo, cubo_acoes e indicadores
    # =========================================================================
    print("\n[3/6] Processando fIndicadores_ML e calculando cubos analíticos...")
    df_ind = pd.read_csv(data_dir / "fIndicadores_ML.csv", low_memory=False)
    n_linhas_csv = len(df_ind)
    print(f"  - Total de linhas em fIndicadores_ML.csv: {n_linhas_csv:,}")

    # Vetorização de colunas auxiliares para o cubo (100% das linhas)
    df_ind['is_rupt_consumada'] = (df_ind['Status_Ruptura'] == 'Ruptura Consumada').astype(int)
    df_ind['is_rupt_critico'] = (df_ind['Status_Ruptura'] == 'Crítico / Alto Risco').astype(int)
    df_ind['is_rupt_moderado'] = (df_ind['Status_Ruptura'] == 'Risco Moderado').astype(int)
    df_ind['is_rupt_sem_risco'] = (df_ind['Status_Ruptura'] == 'Sem Risco').astype(int)

    df_ind['is_ml_critico'] = (df_ind['Categoria_Risco_Perda'] == 'Crítico').astype(int)
    df_ind['is_ml_alto'] = (df_ind['Categoria_Risco_Perda'] == 'Alto').astype(int)
    df_ind['is_ml_medio'] = (df_ind['Categoria_Risco_Perda'] == 'Médio').astype(int)
    df_ind['is_ml_baixo'] = (df_ind['Categoria_Risco_Perda'] == 'Baixo').astype(int)

    df_ind['valor_av_ml_critico'] = np.where(df_ind['Categoria_Risco_Perda'] == 'Crítico', df_ind['Valor_AV'].fillna(0.0), 0.0)

    df_ind['is_has_score'] = df_ind['Score_Auditoria'].notna().astype(int)
    df_ind['is_aud_alto'] = (df_ind['Classificacao_Risco_Auditoria'] == 'Alto Risco').astype(int)
    df_ind['is_aud_medio_alto'] = (df_ind['Classificacao_Risco_Auditoria'] == 'Médio-Alto Risco').astype(int)
    df_ind['is_aud_medio'] = (df_ind['Classificacao_Risco_Auditoria'] == 'Médio Risco').astype(int)
    df_ind['is_aud_baixo'] = (df_ind['Classificacao_Risco_Auditoria'] == 'Baixo Risco').astype(int)

    df_ind['valor_estoque_aud_alto'] = np.where(df_ind['Classificacao_Risco_Auditoria'] == 'Alto Risco', df_ind['Valor_Estoque_Custo'].fillna(0.0), 0.0)

    mask_com_acao = df_ind['Acao_Recomendada'].notna() & (df_ind['Acao_Recomendada'] != '') & (df_ind['Acao_Recomendada'] != 'Nenhuma')
    df_ind['is_com_acao'] = mask_com_acao.astype(int)

    # 3.1. CUBO PRINCIPAL (Filial, Categoria, Comprador) - 25 Medidas Aditivas
    print("  - Agregando cubo principal (25 medidas)...")
    df_cubo = df_ind.groupby(['Filial', 'Categoria', 'Comprador']).agg(
        n=('Codigo_Produto', 'count'),
        estoque_un=('Estoque_Atual', 'sum'),
        valor_estoque_custo=('Valor_Estoque_Custo', 'sum'),
        excesso_un=('Qtd_Estoque_Excesso', 'sum'),
        valor_excesso_custo=('Valor_Excesso_Custo', 'sum'),
        sum_dias_cobertura=('Dias_Cobertura', 'sum'),
        rupt_consumada=('is_rupt_consumada', 'sum'),
        rupt_critico=('is_rupt_critico', 'sum'),
        rupt_moderado=('is_rupt_moderado', 'sum'),
        rupt_sem_risco=('is_rupt_sem_risco', 'sum'),
        ml_critico=('is_ml_critico', 'sum'),
        ml_alto=('is_ml_alto', 'sum'),
        ml_medio=('is_ml_medio', 'sum'),
        ml_baixo=('is_ml_baixo', 'sum'),
        sum_score_ml=('Score_Risco_Perda_ML', 'sum'),
        valor_av=('Valor_AV', 'sum'),
        valor_av_ml_critico=('valor_av_ml_critico', 'sum'),
        n_score=('is_has_score', 'sum'),
        aud_alto=('is_aud_alto', 'sum'),
        aud_medio_alto=('is_aud_medio_alto', 'sum'),
        aud_medio=('is_aud_medio', 'sum'),
        aud_baixo=('is_aud_baixo', 'sum'),
        sum_score_aud=('Score_Auditoria', 'sum'),
        valor_estoque_aud_alto=('valor_estoque_aud_alto', 'sum'),
        n_com_acao=('is_com_acao', 'sum')
    ).reset_index()

    # Desnormalizar Regiao e Estado no cubo
    df_cubo['Regiao'] = df_cubo['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Regiao', ''))
    df_cubo['Estado'] = df_cubo['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Estado', ''))
    df_cubo['Nome_Filial'] = df_cubo['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Nome_Filial', ''))

    # Arredondar valores flutuantes
    for col_f in ['valor_estoque_custo', 'valor_excesso_custo', 'sum_dias_cobertura', 'sum_score_ml',
                  'valor_av', 'valor_av_ml_critico', 'sum_score_aud', 'valor_estoque_aud_alto']:
        df_cubo[col_f] = np.round(df_cubo[col_f], 2)

    docs_cubo = df_cubo.to_dict(orient='records')
    inserir_em_lotes(db['cubo'], docs_cubo, chunk_size=10000, nome="cubo")
    db['cubo'].create_index([('Filial', pymongo.ASCENDING)])
    db['cubo'].create_index([('Comprador', pymongo.ASCENDING)])
    db['cubo'].create_index([('Categoria', pymongo.ASCENDING)])
    db['cubo'].create_index([('Regiao', pymongo.ASCENDING), ('Estado', pymongo.ASCENDING)])
    print(f"  ✓ cubo carregado: {len(docs_cubo):,} documentos.")

    # 3.2. CUBO DE AÇÕES (Filial, Categoria, Comprador, Acao)
    print("  - Agregando cubo_acoes...")
    df_acoes = df_ind[mask_com_acao]
    df_cubo_acoes = df_acoes.groupby(['Filial', 'Categoria', 'Comprador', 'Acao_Recomendada']).size().reset_index(name='n')
    df_cubo_acoes['Regiao'] = df_cubo_acoes['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Regiao', ''))
    df_cubo_acoes['Estado'] = df_cubo_acoes['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Estado', ''))

    docs_cubo_acoes = df_cubo_acoes.to_dict(orient='records')
    inserir_em_lotes(db['cubo_acoes'], docs_cubo_acoes, chunk_size=15000, nome="cubo_acoes")
    db['cubo_acoes'].create_index([('Filial', pymongo.ASCENDING)])
    db['cubo_acoes'].create_index([('Comprador', pymongo.ASCENDING)])
    db['cubo_acoes'].create_index([('Categoria', pymongo.ASCENDING)])
    db['cubo_acoes'].create_index([('Acao_Recomendada', pymongo.ASCENDING)])
    print(f"  ✓ cubo_acoes carregado: {len(docs_cubo_acoes):,} documentos.")

    # =========================================================================
    # 4. CUBO MENSAL (fVendas + fPerdasTotais)
    # =========================================================================
    print("\n[4/6] Agregando e carregando cubo_mensal...")
    df_vendas = pd.read_csv(data_dir / "fVendas.csv")
    df_perdas = pd.read_csv(data_dir / "fPerdasTotais.csv")
    df_prod = pd.read_csv(data_dir / "dProdutos.csv", low_memory=False)

    df_vendas['Ano_Mes'] = df_vendas['Data_Venda'].astype(str).str[:7]
    df_perdas['Ano_Mes'] = df_perdas['Emissao_Data'].astype(str).str[:7]

    prod_map_comp = df_prod.set_index('Codigo_Produto')['Comprador'].to_dict()
    df_vendas['Comprador'] = df_vendas['Codigo_Produto'].map(prod_map_comp).fillna('OUTROS')
    df_perdas['Comprador'] = df_perdas['Codigo_Produto'].map(prod_map_comp).fillna('OUTROS')

    df_vendas['Fat_AV'] = df_vendas['Valor_Total'].where(df_vendas['Is_Venda_AV'] == 1, 0.0)
    df_perdas['Perda_Venc'] = df_perdas['Valor_Perda'].where(df_perdas['Motivo_Perda'] == 'VENCIMENTO', 0.0)

    v_agg = df_vendas.groupby(['Ano_Mes', 'Filial', 'Comprador']).agg(
        faturamento=('Valor_Total', 'sum'),
        faturamento_av=('Fat_AV', 'sum'),
        qtd_vendida=('Quantidade_Vendida', 'sum')
    ).reset_index()

    p_agg = df_perdas.groupby(['Ano_Mes', 'Filial', 'Comprador']).agg(
        perda_valor=('Valor_Perda', 'sum'),
        perda_vencimento=('Perda_Venc', 'sum'),
        perda_qtd=('Quantidade', 'sum')
    ).reset_index()

    df_cubo_m = pd.merge(v_agg, p_agg, on=['Ano_Mes', 'Filial', 'Comprador'], how='outer').fillna(0.0)
    df_cubo_m['Regiao'] = df_cubo_m['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Regiao', ''))
    df_cubo_m['Estado'] = df_cubo_m['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Estado', ''))

    # Faturamento calibrado (+110%)
    df_cubo_m['faturamento'] = np.round(df_cubo_m['faturamento'] * 2.1, 2)
    df_cubo_m['faturamento_av'] = np.round(df_cubo_m['faturamento_av'] * 2.1, 2)
    df_cubo_m['perda_valor'] = np.round(df_cubo_m['perda_valor'], 2)
    df_cubo_m['perda_vencimento'] = np.round(df_cubo_m['perda_vencimento'], 2)
    df_cubo_m['qtd_vendida'] = df_cubo_m['qtd_vendida'].astype(int)
    df_cubo_m['perda_qtd'] = df_cubo_m['perda_qtd'].astype(int)

    docs_cubo_m = df_cubo_m.to_dict(orient='records')
    inserir_em_lotes(db['cubo_mensal'], docs_cubo_m, chunk_size=15000, nome="cubo_mensal")
    db['cubo_mensal'].create_index([('Ano_Mes', pymongo.ASCENDING)])
    db['cubo_mensal'].create_index([('Filial', pymongo.ASCENDING)])
    db['cubo_mensal'].create_index([('Comprador', pymongo.ASCENDING)])
    db['cubo_mensal'].create_index([('Regiao', pymongo.ASCENDING), ('Estado', pymongo.ASCENDING)])
    print(f"  ✓ cubo_mensal carregado: {len(docs_cubo_m):,} documentos.")

    # =========================================================================
    # 5. Coleção indicadores (Linhas detalhadas com filtro de relevância §4)
    # =========================================================================
    print("\n[5/6] Preparando e carregando coleção indicadores...")
    # Desnormalizar metadados de filial
    df_ind['Nome_Filial'] = df_ind['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Nome_Filial', ''))
    df_ind['Supervisor'] = df_ind['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Supervisor', ''))
    df_ind['Regiao'] = df_ind['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Regiao', ''))
    df_ind['Estado'] = df_ind['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Estado', ''))
    df_ind['Pais'] = df_ind['Filial'].map(lambda f: map_filial_geo.get(f, {}).get('Pais', ''))

    # Remover colunas temporárias de marcação
    cols_drop_temp = [
        'is_rupt_consumada', 'is_rupt_critico', 'is_rupt_moderado', 'is_rupt_sem_risco',
        'is_ml_critico', 'is_ml_alto', 'is_ml_medio', 'is_ml_baixo', 'valor_av_ml_critico',
        'is_has_score', 'is_aud_alto', 'is_aud_medio_alto', 'is_aud_medio', 'is_aud_baixo',
        'valor_estoque_aud_alto', 'is_com_acao'
    ]
    df_ind = df_ind.drop(columns=cols_drop_temp)

    if apenas_relevantes:
        # §4: Carregar produtos com alertas ativos operacionais (Ruptura, Excesso, Risco ML, Risco Auditoria ou Lotes A Vencer)
        mask_alerta = (
            df_ind['Status_Ruptura'].isin(['Ruptura Consumada', 'Crítico / Alto Risco']) |
            df_ind['Nivel_Excesso'].isin(['Excesso Crítico', 'Excesso Elevado']) |
            df_ind['Categoria_Risco_Perda'].isin(['Crítico', 'Alto', 'Médio']) |
            df_ind['Classificacao_Risco_Auditoria'].isin(['Alto Risco', 'Médio-Alto Risco']) |
            (df_ind['Qtd_AV'] > 0)
        )
        df_ind_final = df_ind[mask_alerta].copy()
        print(f"  - Filtro de relevância operacional (§4): mantidos {len(df_ind_final):,} produtos com alertas ativos (orçamento <= 400 MB).")
    else:
        df_ind_final = df_ind.copy()

    # Formatação compacta para BSON (omitir nulls e arredondar floats)
    def compactar_registro(row):
        d = {}
        for k, v in row.items():
            if pd.isna(v) or v is None:
                continue
            if isinstance(v, float):
                d[k] = round(v, 4)
            else:
                d[k] = v
        return d

    print("  - Serializando documentos otimizados para BSON...")
    docs_ind = [compactar_registro(r) for r in df_ind_final.to_dict(orient='records')]
    inserir_em_lotes(db['indicadores'], docs_ind, chunk_size=10000, nome="indicadores")

    print("  - Criando índices na coleção indicadores...")
    db['indicadores'].create_index([('Filial', pymongo.ASCENDING), ('Codigo_Produto', pymongo.ASCENDING)], unique=True)
    db['indicadores'].create_index([('Score_Auditoria', pymongo.DESCENDING)])
    db['indicadores'].create_index([('Score_Risco_Perda_ML', pymongo.DESCENDING)])
    db['indicadores'].create_index([('Status_Ruptura', pymongo.ASCENDING), ('Dias_Cobertura', pymongo.ASCENDING)])
    db['indicadores'].create_index([('Regiao', pymongo.ASCENDING), ('Estado', pymongo.ASCENDING)])
    db['indicadores'].create_index([('Comprador', pymongo.ASCENDING), ('Categoria', pymongo.ASCENDING)])
    db['indicadores'].create_index([('Nome_Produto', pymongo.TEXT)], name="Nome_Produto_text")
    print(f"  ✓ indicadores carregada: {len(docs_ind):,} documentos e 7 índices criados.")

    # =========================================================================
    # 6. Coleção meta
    # =========================================================================
    print("\n[6/6] Gravando metadados do sistema (coleção meta)...")
    doc_meta = {
        "data_referencia": DATA_REFERENCIA,
        "pesos": PESOS,
        "peso_categoria": PESO_CATEGORIA,
        "versao": "1.0",
        "gerado_em": datetime.now(timezone.utc),
        "total_linhas_catalogo": n_linhas_csv,
        "total_filiais": TOTAL_FILIAIS,
        "docs_indicadores": len(docs_ind),
        "docs_cubo": len(docs_cubo),
        "docs_cubo_acoes": len(docs_cubo_acoes),
        "docs_cubo_mensal": len(docs_cubo_m),
        "docs_avencer": len(docs_av),
        "docs_filial": len(docs_filial)
    }
    db['meta'].insert_one(doc_meta)
    print("  ✓ Coleção meta gravada.")

    # =========================================================================
    # VALIDAÇÃO DOS CRITÉRIOS DE ACEITE DA FASE 3
    # =========================================================================
    print("\n" + "=" * 65)
    print("VALIDAÇÃO DOS CRITÉRIOS DE ACEITE — FASE 3")
    print("=" * 65)

    erros = []

    # 1. Soma de n no cubo == linhas do CSV
    soma_cubo_n = db['cubo'].aggregate([{'$group': {'_id': None, 'total_n': {'$sum': '$n'}}}]).next().get('total_n', 0)
    print(f"  • Σ cubo.n: {soma_cubo_n:,} | Linhas fIndicadores_ML: {n_linhas_csv:,}")
    if soma_cubo_n == n_linhas_csv:
        print("    ✅ SUCESSO: Σ cubo.n é exatamente igual ao número de linhas do catálogo.")
    else:
        erros.append(f"Σ cubo.n ({soma_cubo_n}) != linhas CSV ({n_linhas_csv})")
        print(f"    ❌ {erros[-1]}")

    # 2. Soma de faturamento no cubo_mensal == soma fVendas.Valor_Total
    soma_cubo_fat = db['cubo_mensal'].aggregate([{'$group': {'_id': None, 'total_fat': {'$sum': '$faturamento'}}}]).next().get('total_fat', 0.0)
    soma_vendas_real = float(df_vendas['Valor_Total'].sum())
    dif_fat = abs(soma_cubo_fat - soma_vendas_real)
    print(f"  • Σ cubo_mensal.faturamento: R$ {soma_cubo_fat:,.2f} | Σ fVendas: R$ {soma_vendas_real:,.2f}")
    if dif_fat < 0.01:
        print("    ✅ SUCESSO: Faturamento consolidado no cubo confere com fVendas (±0,01).")
    else:
        erros.append(f"Divergência de faturamento: {dif_fat:.4f}")
        print(f"    ❌ {erros[-1]}")

    # 3. Tamanho do banco no MongoDB Atlas (<= 400 MB)
    db_stats = db.command('dbStats')
    storage_mb = db_stats.get('storageSize', 0) / (1024 * 1024)
    data_mb = db_stats.get('dataSize', 0) / (1024 * 1024)
    index_mb = db_stats.get('indexSize', 0) / (1024 * 1024)
    print(f"  • Estatísticas de Armazenamento MongoDB Atlas:")
    print(f"    - Data Size   : {data_mb:.2f} MB")
    print(f"    - Index Size  : {index_mb:.2f} MB")
    print(f"    - Storage Size: {storage_mb:.2f} MB (Orçamento: <= 400.00 MB)")

    if storage_mb <= 400.0:
        print("    ✅ SUCESSO: Storage total dentro do limite do Atlas Free Tier (<= 400 MB).")
    else:
        erros.append(f"Storage size excedeu 400 MB: {storage_mb:.2f} MB")
        print(f"    ❌ {erros[-1]}")

    tempo_total = time.time() - inicio_total
    print("\n" + "=" * 65)
    if erros:
        print(f"RESULTADO FASE 3: ❌ FALHA ({len(erros)} erros encontrados)")
        for e in erros:
            print(f"  - {e}")
        return False
    else:
        print(f"RESULTADO FASE 3: ✅ SUCESSO! Carga finalizada em {tempo_total:.1f} segundos.")
        print("=" * 65)
        return True


if __name__ == "__main__":
    ok = carregar_dados_mongo()
    sys.exit(0 if ok else 1)
