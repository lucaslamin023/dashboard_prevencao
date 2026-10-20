import os
import sys
from pathlib import Path
import pandas as pd

# Reconfigure stdout/stderr for UTF-8 on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Add parent directory to path to allow direct execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.config import DIR_CONSOLIDADOS
from etl.indicadores_ml import calcular_indicadores_ml
from etl.score_auditoria import calcular_score_auditoria


def gerar_indicadores(data_dir=DIR_CONSOLIDADOS, output_file=None):
    """
    Orquestra o cálculo dos indicadores de ML existentes + novo Score de Auditoria (§3.1).
    Grava o resultado consolidado em Dados_Consolidados/fIndicadores_ML.csv.
    """
    if output_file is None:
        output_file = data_dir / "fIndicadores_ML.csv"

    print("=" * 65)
    print("🚀 INICIANDO GERAÇÃO DE INDICADORES (ML + SCORE DE AUDITORIA)")
    print(f"Diretório dos dados: {data_dir}")
    print(f"Arquivo de saída   : {output_file}")
    print("=" * 65)

    # 1. Calcular Indicadores ML e Operacionais
    df_ml = calcular_indicadores_ml(data_dir=data_dir, verbose=True)

    # 2. Calcular Score de Auditoria e Features Explicáveis
    df_score = calcular_score_auditoria(data_dir=data_dir, verbose=True)

    print("\n--- Integrando conjuntos de indicadores ---")
    # As chaves são (Filial, Codigo_Produto)
    # df_ml já possui: Filial, Codigo_Produto, Nome_Produto, Categoria, Comprador,
    # Estoque_Atual, Demanda_Atual, Demanda_Ponderada, Dias_Cobertura, Status_Ruptura,
    # Qtd_Estoque_Excesso, Nivel_Excesso, Indice_Excesso_Filial_Perc,
    # Qtd_AV, Valor_AV, Qtd_Vendas_Normais, Qtd_Vendas_AV, Qtd_Perdas, Valor_Perdas,
    # Score_Risco_Perda_ML, Categoria_Risco_Perda, Valor_Estoque_Custo, Valor_Excesso_Custo.

    # Colunas a importar do df_score:
    colunas_score = [
        'Filial', 'Codigo_Produto',
        'Grupo', 'Principio_Ativo', 'MG', 'Custo', 'Demanda_Rede',
        'Ultima_Venda', 'Ultima_Entrada', 'Qtd_A_Vencer', 'Qtd_Perdida_Ano',
        'Tendencia_Perda', 'Prazo_Validade_Meses', 'Qtd_Vendida_Maior_Filial',
        'Filial_Maior_Venda', 'Vendas_PA_Filial', 'Vendas_PA_Rede',
        'Score_Auditoria_Base', 'Score_Auditoria', 'Classificacao_Risco_Auditoria',
        'Risco_Demanda_Venda', 'Acao_Recomendada', 'Produto_Referencia_PA',
        'Contrib_meses_desde_ultima_venda',
        'Contrib_estoque_sobre_demanda_log',
        'Contrib_proporcao_a_vencer',
        'Contrib_proporcao_perda',
        'Contrib_custo_total_estoque',
        'Contrib_TENDENCIA_NUM',
        'Contrib_venda_max_log',
        'Contrib_demanda_rede_log',
        'Contrib_dias_desde_ultima_entrada',
        'Contrib_Categoria'
    ]

    # Evitar colisão de Demanda_Rede
    if 'Demanda_Rede' in df_ml.columns:
        df_ml = df_ml.drop(columns=['Demanda_Rede'])

    df_consolidado = df_ml.merge(df_score[colunas_score], on=['Filial', 'Codigo_Produto'], how='left')

    # Ordenação final rigorosa de colunas conforme §3.7
    colunas_finais = [
        # Existentes (21)
        'Filial', 'Codigo_Produto', 'Nome_Produto', 'Categoria', 'Comprador',
        'Estoque_Atual', 'Demanda_Atual', 'Demanda_Ponderada', 'Dias_Cobertura',
        'Status_Ruptura', 'Qtd_Estoque_Excesso', 'Nivel_Excesso', 'Indice_Excesso_Filial_Perc',
        'Qtd_AV', 'Valor_AV', 'Qtd_Vendas_Normais', 'Qtd_Vendas_AV', 'Qtd_Perdas', 'Valor_Perdas',
        'Score_Risco_Perda_ML', 'Categoria_Risco_Perda',
        # Novas colunas de negócio (23)
        'Grupo', 'Principio_Ativo', 'MG', 'Custo', 'Demanda_Rede',
        'Ultima_Venda', 'Ultima_Entrada', 'Qtd_A_Vencer', 'Qtd_Perdida_Ano',
        'Tendencia_Perda', 'Prazo_Validade_Meses', 'Qtd_Vendida_Maior_Filial',
        'Filial_Maior_Venda', 'Vendas_PA_Filial', 'Vendas_PA_Rede',
        'Valor_Estoque_Custo', 'Valor_Excesso_Custo',
        'Score_Auditoria_Base', 'Score_Auditoria', 'Classificacao_Risco_Auditoria',
        'Risco_Demanda_Venda', 'Acao_Recomendada', 'Produto_Referencia_PA',
        # Contribuições (10)
        'Contrib_meses_desde_ultima_venda',
        'Contrib_estoque_sobre_demanda_log',
        'Contrib_proporcao_a_vencer',
        'Contrib_proporcao_perda',
        'Contrib_custo_total_estoque',
        'Contrib_TENDENCIA_NUM',
        'Contrib_venda_max_log',
        'Contrib_demanda_rede_log',
        'Contrib_dias_desde_ultima_entrada',
        'Contrib_Categoria'
    ]

    df_final = df_consolidado[colunas_finais].copy()

    # Formatar strings vazias para nulos de forma padronizada
    df_final['MG'] = df_final['MG'].fillna('')

    print(f"Exportando {len(df_final):,} linhas e {len(colunas_finais)} colunas para {output_file}...")
    df_final.to_csv(output_file, index=False, encoding='utf-8-sig')

    print("\n" + "=" * 65)
    print("✨ fIndicadores_ML.csv GERADO COM SUCESSO!")
    print(f"Arquivo: {output_file}")
    print("=" * 65)
    return df_final


if __name__ == "__main__":
    gerar_indicadores()
