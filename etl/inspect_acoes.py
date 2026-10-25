import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
client = MongoClient(os.getenv("MONGO_URL"))
db = client.get_database("prevencao_perdas")

print("Distinct actions in indicadores:")
for v in db.indicadores.distinct("Acao_Recomendada"):
    count = db.indicadores.count_documents({"Acao_Recomendada": v})
    print(f"- {repr(v)}: {count}")

print("\nDistinct actions in cubo_acoes:")
for v in db.cubo_acoes.distinct("Acao_Recomendada"):
    print(f"- {repr(v)}")
