import os
import sys
from pathlib import Path
import pymongo
from dotenv import load_dotenv

# Carrega .env
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

client = pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=10000)
db = client.get_database()
if db.name in ['test', 'admin', '']:
    db = client['prevencao_perdas']

print(f"✓ Conectado ao MongoDB: {db.name}")

# =============================================================================
# 1. ATUALIZAÇÃO DOS NOMES DAS REGIÕES BRASILEIRAS
# =============================================================================
mapa_regioes = {
    'Centro-Oeste': 'Brasil - Centro-Oeste',
    'Norte': 'Brasil - Norte',
    'Nordeste': 'Brasil - Nordeste',
    'Sudeste': 'Brasil - Sudeste',
    'Sul': 'Brasil - Sul',
}

print("\n[1/2] Atualizando nomenclatura das regiões brasileiras nas coleções...")
for col_name in ['dFilial', 'cubo', 'cubo_mensal', 'cubo_acoes', 'indicadores']:
    total_mod = 0
    for reg_antiga, reg_nova in mapa_regioes.items():
        res = db[col_name].update_many(
            {'Regiao': reg_antiga},
            {'$set': {'Regiao': reg_nova}}
        )
        total_mod += res.modified_count
    print(f"  ✓ {col_name}: {total_mod:,} documentos atualizados com 'Brasil - Região'.")

# =============================================================================
# 2. INFLAR FATURAMENTO EM 110% (Multiplicador 2.1x)
# =============================================================================
print("\n[2/2] Inflando faturamento em cubo_mensal em 110% (multiplicador 2.1x)...")
res_fat = db['cubo_mensal'].update_many(
    {},
    [
        {
            '$set': {
                'faturamento': {'$round': [{'$multiply': ['$faturamento', 2.1]}, 2]},
                'faturamento_av': {'$round': [{'$multiply': ['$faturamento_av', 2.1]}, 2]}
            }
        }
    ]
)
print(f"  ✓ cubo_mensal: {res_fat.modified_count:,} registros de faturamento atualizados!")

# Verificação
totais = list(db['cubo_mensal'].aggregate([
    {
        '$group': {
            '_id': None,
            'fat_total': {'$sum': '$faturamento'},
            'perda_total': {'$sum': '$perda_valor'}
        }
    }
]))
if totais:
    fat = totais[0]['fat_total']
    perda = totais[0]['perda_total']
    print(f"\n📊 Novo Faturamento Total: R$ {fat:,.2f} | Perdas: R$ {perda:,.2f} | % Perda: {(perda/fat)*100:.2f}%")

print("\n🚀 Atualizações na base concluídas com sucesso!")
