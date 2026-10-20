import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DIR_ANONIMIZADOS = BASE_DIR / "Dados_Anonimizados"
DIR_CONSOLIDADOS = BASE_DIR / "Dados_Consolidados"

# Core deterministic parameters
SEED = 42
DATA_REFERENCIA = "2026-09-30"
TOTAL_FILIAIS = 232

# Weights for Score de Auditoria (Section 3.3, sum = 1.0)
PESOS = {
    'meses_desde_ultima_venda': 0.22,
    'estoque_sobre_demanda_log': 0.15,
    'proporcao_a_vencer': 0.13,
    'proporcao_perda': 0.13,
    'custo_total_estoque': 0.13,
    'TENDENCIA_NUM': 0.08,
    'venda_max_log': 0.065,
    'demanda_rede_log': 0.065,
    'dias_desde_ultima_entrada': 0.03,
}

# Category weights for Score de Auditoria bonus (Section 3.3)
PESO_CATEGORIA = {
    'Prescrição Médica': 9,
    'Medicamentos Isentos (MIP)': 7,
    'Dermocosméticos': 6,
    'Suplementos & Vitaminas': 5,
    'Primeiros Socorros': 5,
    'Higiene & Cuidados Pessoais': 4,
    'Cosméticos Capilares': 4,
    'Beleza & Maquiagem': 4,
    'Nutrição Esportiva': 3,
    'Mamãe & Bebê': 2,
}

# Thresholds
LIMIAR_TENDENCIA = 0.05
BONUS_CATEGORIA_PESO = 0.10

# Classification thresholds (Score_Base)
LIMIARES_SCORE = [
    (0.10, "Baixo Risco"),
    (0.20, "Médio Risco"),
    (0.30, "Médio-Alto Risco"),
]  # >= 0.30 is Alto Risco
