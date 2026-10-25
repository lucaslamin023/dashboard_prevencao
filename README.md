# Plataforma Analítica de Prevenção de Perdas & Gestão de Estoque Farmacêutico

Sistema completo de inteligência analítica e prevenção de perdas no varejo farmacêutico construído com arquitetura **MERN** (*MongoDB Atlas, Express, React e Node.js*), complementado por um pipeline robusto de **ETL em Python** para processamento, consolidação estatística e auditoria multicritério de estoques.

---

## 1. Visão Geral e Utilidade do Dashboard

No varejo farmacêutico moderno, perdas operacionais, desabastecimento (ruptura) e capital imobilizado em excesso de estoque representam os maiores vetores de erosão de margem e penalidades regulatórias (como regras de programas de acesso a medicamentos e Farmácia Popular).

Este dashboard atua como uma **torre de controle central de Prevenção de Perdas e Gestão de Supply Chain**, fornecendo:
- **Visão Executiva em Tempo Real:** Acompanhamento consolidado do Faturamento (~R$ 3,01 Bilhões), Perdas Operacionais Totais e correlação entre vendas normais e produtos a vencer.
- **Gestão Ativa de Produtos a Vencer (AV):** Monitoramento da taxa de conversão contra a meta institucional de 80%, identificando filiais e produtos com risco iminente de expiração para campanhas de liquidação e repasse.
- **Auditoria de Inventários & Acuracidade:** Avaliação da conformidade física vs sistêmica por loja, identificação de filiais com reincidência de falha e cálculo de divergências líquidas (sobras vs faltas).
- **Controle de Capital Imobilizado por Excesso:** Classificação de cobertura de estoque por loja e supervisor, isolando o capital em risco (> 60 dias de demanda projetada).
- **Monitor de Ruptura & Abastecimento:** Detecção precoce de produtos em risco crítico (< 3 dias de autonomia) e ruptura consumada (0 unidades com demanda ativa), gerando listas imediatas de ressuprimento.
- **Score de Auditoria Multicritério com Explicabilidade:** Algoritmo ponderado que avalia 9 fatores de risco por SKU/loja, classificando em 4 faixas de risco e sugerindo automaticamente diretrizes operacionais de mitigação (cotação, reposicionamento, transferência por princípio ativo ou venda prioritária).

---

## 2. Origem dos Dados e Contexto Corporativo

Na operação em produção da empresa, os dados são ingeridos de forma automatizada diretamente do **Data Warehouse / ERP Corporativo (banco relacional Oracle)** através de pipelines agendados de integração de dados.

Para este projeto analítico de portfólio, demonstração pública e estrita conformidade com a **LGPD (Lei Geral de Proteção de Dados)**:
1. **Anonimização & Sintetização:** Os dados originais foram anonimizados com técnicas de mascaramento de identidades, codificação de filiais, compradores e produtos.
2. **Consolidação em Python:** Processamento determinístico em Python (`pandas/numpy`) para calibração estatística de distribuições reais do setor farmacêutico.
3. **Modelagem no MongoDB Atlas:** Armazenamento analítico de alta performance em banco NoSQL gerenciado na nuvem, utilizando **cubos analíticos pré-agregados** (`cubo`, `cubo_mensal`, `cubo_acoes`, `cubo_mensal_av`) para viabilizar consultas submétricas em dashboards de grande escala, complementado por coleções transacionais paginadas com índices compostos.

---

## 📊 3. Módulos e Indicadores do Dashboard

A plataforma é composta por 6 telas de inteligência analítica mais uma tela técnica de metodologia:

### 1. Executive Overview & Perdas Farmacêuticas (`/`)
- **Faturamento Total da Rede:** Volume financeiro faturado (~R$ 3,01 Bilhões).
- **Perdas Operacionais Totais:** R$ 8,59 M (~0,29% do faturamento), decompostas em:
  - Perda por Vencimento (produtos expirados na prateleira/depósito).
  - Perda por Quebra / Danificados (avarias logísticas e de manuseio).
  - Divergência Líquida de Inventário (perda apurada em auditorias periódicas).
- **Vendas A Vencer (AV):** R$ 2,33 M faturados em produtos com validade monitorada.
- **Taxa de Ruptura Severa:** 5,3% da rede em situação crítica ou consumada.
- **Itens em Alto Risco (Auditoria):** 12.256 itens críticos identificados preventivamente.
- **Gráficos:** Combo Chart de Faturamento (barras) × Perdas (linha no eixo secundário), Donut de Composição de Vendas (Normal 80% × AV 20%) e Matriz de Performance por Filial.

### 2. Vendas A Vencer (`/vendas-av`)
- **Faturamento AV Realizado:** R$ 2,33 Milhões.
- **Taxa de Conversão de Estoque AV:** 89,4% (Meta corporativa de 80,0% sobre o total a vencer).
- **Volume Liquidado:** 76.620 unidades salvas antes do vencimento.
- **Ticket Médio AV:** R$ 30,36 por transação.
- **Venda Abaixo do Custo:** Índice de 12,0% de produtos liquidados em último caso.
- **Gráficos & Tabelas:** Série Temporal de Faturamento AV vs Volume, Distribuição por Categoria Farmacêutica e Ranking das Top Filiais em eficiência de liquidação.

### 3. Acuracidade de Estoque & Auditoria de Inventários (`/inventario`)
- **Acuracidade Média Geral:** 98,87% de acuracidade na rede (Meta: 99,50%; Limiar Crítico: < 99,00%).
- **Lojas Dentro da Meta:** 1.180 inventários conformes (64,7%).
- **Taxa de Reincidência:** 47,8% (lojas que falharam na meta em dois inventários consecutivos).
- **Filiais em Estado Urgente:** 48 filiais críticas no último inventário realizado.
- **Divergência Financeira Líquida:** -R$ 7.217.941,31 (R$ 13,3 M em Sobras vs R$ 20,5 M em Faltas).
- **Matriz de Último Inventário por Filial:** Tabela auditável filtrável dinamicamente por Supervisor, Região, Estado e Loja.

### 4. Excesso de Estoque & Capital Imobilizado (`/excesso`)
- **Estoque Total da Rede:** 3.273.212 unidades.
- **Volume em Excesso:** 157.691 unidades com cobertura > 60 dias (Índice de 4,8%).
- **Capital Imobilizado:** R$ 3.829.664,81 em valor de custo parado.
- **Filiais em Excesso Crítico:** 26 filiais com índice de excesso superior a 5,0%.
- **Ranking Top 10 Lojas com Capital Imobilizado:** Gráfico de barras horizontais indicando a loja e o respectivo **Supervisor**.
- **Composição por Categoria:** Barras empilhadas com as 3 faixas de autonomia (*Normal ≤ 60d, Elevado 60-90d, Crítico > 90d*).
- **Matriz de Ação e Capital Imobilizado:** Tabela gerencial detalhando Filial, Unidade, Supervisor, Estoque, Excesso e Valor Represado.

### 5. Monitor de Ruptura & Cobertura de Estoque (`/ruptura`)
- **Cobertura Média:** 20,1 dias de abastecimento.
- **Ruptura Consumada:** 3.597 ocorrências (1,8% do catálogo) com estoque zero e demanda compradora ativa.
- **Estoque Crítico / Alto Risco:** 7.105 ocorrências (3,5%) com autonomia inferior a 3 dias.
- **Distribuição do Portfólio por Autonomia (Donut):**
  - *Sem Risco (> 10 dias):* 61,3%
  - *Risco Moderado (3 a 10 dias):* 33,4%
  - *Crítico / Alto Risco (< 3 dias):* 3,5%
  - *Ruptura Consumada (0 dias):* 1,8%
- **Fila Operacional de Ressuprimento:** Lista priorizada para transferência entre Centros de Distribuição e pedidos emergenciais, com botão de **Exportar CSV**.

### 6. Score de Auditoria & Ações Recomendadas (`/score`)
- **Distribuição de Risco:** 12.256 itens em *Alto Risco*, 20.105 em *Médio-Alto Risco*, Score Médio da Rede de 0,143 e 54.061 itens com plano de ação ativo.
- **Diretrizes Operacionais Automatizadas:**
  - *Cotação do produto no mercado e avaliar ajuste de preço.*
  - *Reposicionar e priorizar venda / Filial acompanhar a saída.*
  - *Transferir para filial/loja com demanda do SKU.*
  - *Transferir para filial/loja com demanda do princípio ativo.*
  - *Acionar Inteligência de Mercado ou representante do fabricante.*
  - *Produto crítico: vender abaixo do custo (última prioridade).*
- **Mapa de Calor:** Risco médio cruzando Categoria Farmacêutica × Supervisor.
- **Drawer de Explicabilidade Detalhada ("Por que este score?"):** Ao clicar em qualquer linha da tabela de auditoria, um painel lateral exibe os valores brutos, os lotes cadastrados a vencer, a regra disparada e a decomposição visual das 9 contribuições matemáticas que formaram o score final.

### 7. Metodologia (`/metodologia`)
Documentação conceitual integrada à UI descrevendo fórmulas, limiares de negócio e a tabela de ponderação de pesos do Score de Auditoria.

---

## 📐 4. Matriz de Ponderação do Score de Auditoria

O Score de Auditoria é calculado por normalização min-max local *(Filial, Categoria)* e ponderado por 9 fatores determinísticos:

| Fator de Risco | Peso Relativo | Critério e Impacto |
|---|---|---|
| **Meses Sem Venda** | **22%** | Dias decorridos desde a última saída comercial. Se última entrada < 4 meses, ajustado para 1 mês. |
| **Cobertura de Estoque** | **15%** | Razão logarítmica entre Estoque Atual e Demanda Projetada (`log1p(Estoque / Demanda)`). |
| **Proporção a Vencer** | **13%** | Percentual do estoque físico comprometido com lotes próximos da expiração. |
| **Proporção de Perda** | **13%** | Razão entre a quantidade perdida nos últimos 12 meses e o estoque atual mantido na loja. |
| **Capital Total Parado** | **13%** | Valor monetário de custo retido na filial (`Estoque_Atual × Custo_Referencia`). |
| **Tendência de Perda** | **8%** | Inclinação linear estatística (slope) do volume mensal de perdas nos últimos 365 dias. |
| **Demanda na Rede** | **6,5%** | Demanda total consolidada de outras lojas da rede para avaliar viabilidade de transferência. |
| **Concentração na Maior Filial** | **6,5%** | Razão entre a maior demanda pontual da rede e o estoque da filial atual. |
| **Dias Sem Entrada** | **3%** | Tempo desde o último faturamento do fornecedor para a filial (teto de 365 dias). |
| **Bônus de Categoria** | **Até +0,10** | Calibração de criticidade sanitária e perecibilidade (Prescrição Médica +0,10; MIP +0,07; Dermocosméticos +0,06; etc.). |

---

## 🏗️ 5. Arquitetura da Solução

```
dashboard_prevencao/
├── etl/                                 # Pipeline de Engenharia de Dados em Python
│   ├── config.py                        # Constantes, pesos do score, data de referência
│   ├── consolidar_dados.py              # Consolidação estatística e higienização
│   ├── gerar_indicadores.py             # Orquestrador de indicadores analíticos
│   ├── score_auditoria.py               # Algoritmo vetorizado de Score de Auditoria
│   ├── regras_acao.py                   # Motor determinístico de ações operacionais
│   ├── carregar_mongo.py                # Carga de cubos analíticos no MongoDB Atlas
│   ├── validar.py                       # Assertions e testes de integridade analítica
│   ├── requirements.txt                 # Dependências Python (pandas, numpy, pymongo, etc.)
│   └── tests/                           # Testes unitários do pipeline
├── dashboard/
│   ├── server/                          # Backend API REST (Node.js + Express)
│   │   ├── src/
│   │   │   ├── app.js                   # Configuração Express, Helmet, CORS, Rate-Limit, Proxy
│   │   │   ├── index.js                 # Inicialização do servidor HTTP e conexão Atlas
│   │   │   ├── config/db.js             # Singleton de conexão MongoDB Driver nativo
│   │   │   ├── controllers/             # Controladores das rotas analíticas
│   │   │   ├── routes/                  # Definições de rotas da API
│   │   │   └── services/filtros.js      # Parser centralizado de filtros globais e cubos
│   │   ├── tests/api.test.js            # Suíte completa de 30 testes automatizados (Vitest)
│   │   ├── package.json
│   │   └── .env.example
│   └── client/                          # Frontend SPA (React 18 + Vite + MUI v5)
│       ├── src/
│       │   ├── App.jsx                  # Roteamento central e Layout
│       │   ├── theme.js                 # Design system (Dark Slate moderno, semântica e paleta)
│       │   ├── state/                   # Redux Toolkit & RTK Query com retry exponencial
│       │   ├── components/              # Componentes reutilizáveis (KpiCard, ChartCard, FilterBar, etc.)
│       │   └── scenes/                  # Páginas analíticas do sistema
│       ├── vite.config.js               # Otimização de build com chunks manuais (Vendor, MUI, Charts)
│       ├── package.json
│       └── .env.example
├── render.yaml                          # Blueprint de infraestrutura como código para o Render
└── .gitignore                           # Proteção de credenciais, dados brutos e scripts temporários
```

---

## ⚡ 6. Comandos de Execução

### Pré-requisitos
- **Node.js** >= 20.x
- **Python** >= 3.11
- Conta no **MongoDB Atlas** com cluster ativo (ou MongoDB local)

### 6.1 Pipeline ETL (Python)
```bash
# 1. Navegue até a raiz do projeto e crie o ambiente virtual
python -m venv .venv
# Ativar no Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Ativar no Linux/Mac:
source .venv/bin/activate

# 2. Instale as dependências
pip install -r etl/requirements.txt

# 3. Configure as variáveis de ambiente em etl/.env (conforme etl/.env.example)

# 4. Execute a consolidação e geração de indicadores
python etl/consolidar_dados.py
python etl/gerar_indicadores.py

# 5. Valide os invariantes de negócio
python etl/validar.py

# 6. Carregue os cubos analíticos no MongoDB Atlas
python etl/carregar_mongo.py
```

### 6.2 Backend API (Node.js)
```bash
cd dashboard/server

# Instale as dependências
npm install

# Inicie o servidor em modo de desenvolvimento (hot-reload via nodemon)
npm run dev

# Execute a suíte de testes automatizados (Vitest)
npm test
```
*O servidor estará acessível em `http://localhost:5000` (Health Check: `http://localhost:5000/health`).*

### 6.3 Frontend Dashboard (React / Vite)
```bash
cd dashboard/client

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento Vite
npm run dev

# Para gerar o bundle de produção otimizado
npm run build
```
*O dashboard estará acessível em `http://localhost:3000`.*

---

## 🔐 7. Variáveis de Ambiente

O projeto possui exemplos documentados para cada camada:

### `dashboard/server/.env.example`
```env
# String de conexão com o MongoDB Atlas
MONGO_URL=mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/prevencao_perdas?retryWrites=true&w=majority

# Porta da API
PORT=5000

# URL do Frontend autorizada no CORS (no Render, use a URL do Static Site)
CLIENT_URL=http://localhost:3000

# Ambiente
NODE_ENV=production
```

### `dashboard/client/.env.example`
```env
# Em desenvolvimento local, deixar vazio utiliza o proxy reverso do Vite para a porta 5000
# Em produção (Render), apontar para a URL do Web Service da API
VITE_API_URL=https://prevencao-api.onrender.com
```

---

## 🚀 8. Deploy no Render (`render.yaml`)

A aplicação está configurada para deploy automatizado através do **Render Blueprint** ([`render.yaml`](file:///e:/programing/DADOS/Prevenção%20Perdas/render.yaml)):

- **Web Service (`prevencao-api`)**: Serviço Node.js para a API REST, com suporte a `trust proxy`, rate-limiter, compressão Gzip e verificação de integridade via `/health`.
- **Static Site (`prevencao-web`)**: Aplicação SPA React/Vite com regras de reescrita para suporte ao React Router (`/*` -> `/index.html`) e CDN global.

*Caso esteja em ambiente com plano gratuito do Render, o client inclui uma camada de **Retry Exponencial (3 tentativas)** no RTK Query e banner informativo de cold-start para acordar a API sem erros na interface.*

---

## 🛠️ 9. Desvios Técnicos Adotados (D1 a D5)

Em relação aos protótipos em notebooks de análise exploratória anteriores, foram formalizados 5 desvios técnicos intencionais para garantir precisão e escalabilidade em produção:

| ID | Regra Original / Problema | Solução Adotada em Produção | Justificativa de Engenharia |
|---|---|---|---|
| **D1** | Typo de rótulo no notebook (`'Média Alto Risco'` vs `'Médio Alto Risco'`), impedindo a concessão do bônus de categoria. | Padronização no rótulo canônico **`Médio-Alto Risco`**. | Restaura a intenção original do modelo estatístico, aplicando o bônus de categoria corretamente. |
| **D2** | Bug no `combine_first` de normalização em séries numéricas com valor zero, que desfazia o min-max. | Normalização min-max calculada **estritamente nos valores ≠ 0**, mantendo zeros inalterados. | Evita distorção estatística em produtos que nunca apresentaram tendência de perda. |
| **D3** | Dependência de módulo externo fechado (`regras3.py`) inexistente no repositório. | Reimplementação determinística e modularizada em [`etl/regras_acao.py`](file:///e:/programing/DADOS/Prevenção%20Perdas/etl/regras_acao.py). | Garante autonomia, 100% de reprodutibilidade e auditabilidade nas ações recomendadas. |
| **D4** | Multiplicação cartesiana de linhas de vencimento por produto na base da intranet. | Granularidade estrita no grão **(Filial, SKU)**, selecionando o lote de **menor prazo** e agrupando lotes secundários no detalhe. | Mantém o grão único para agregação analítica no dashboard e evita inflação de estoque. |
| **D5** | Ausência de limite superior em `dias_desde_ultima_entrada` (datas de 1900 geravam distorções > 45.000 dias). | Aplicação de teto via `clip(max=365)`. | Impede que registros legados dominem artificialmente o peso da normalização min-max. |

---

## ⚠️ 10. Limitações e Premissas do Projeto

1. **Dados Sintéticos e Anonimizados:** Todas as informações de filiais, fornecedores, marcas e registros de perdas foram anonimizados ou gerados com sementes pseudoaleatórias reprodutíveis (`SEED=42`), preservando apenas padrões estatísticos e ordens de grandeza.
2. **Proxies de Venda & Demanda:** Devido ao isolamento do ambiente analítico e proteção de segredo de negócio, as vendas diárias foram modeladas a partir da demanda ponderada e do faturamento histórico dos produtos.
3. **Indicador Experimental de ML:** Conforme alinhamento de negócio, modelos caixa-preta de regressão/classificação (Random Forest) foram descartados em favor do **Score de Auditoria Multicritério**, que oferece explicabilidade transparente (auditoria causal) em conformidade com as diretrizes de governança corporativa.

---

## 📈 11. Métricas de Performance e Qualidade (QA Final)

### Estatísticas do Banco de Dados (MongoDB Atlas M0 - Free Tier)
- **Armazenamento Total:** **159,32 MB** (Storage: 123,51 MB + Índices: 35,80 MB).
- **Consumo da Cota:** Utiliza apenas **~31%** do limite de 512 MB do plano M0 do MongoDB Atlas.
- **Coleções Principais:**
  - `indicadores`: 200.581 documentos detalhados por SKU/Filial.
  - `cubo_mensal`: 101.727 documentos para série temporal e filtros cruzados.
  - `cubo`: 7.695 documentos agregados (Filial × Categoria × Comprador).
  - `cubo_mensal_av`: 74.319 documentos de produtos a vencer.
  - `vendas_av`: 50.000 registros de transações de itens a vencer.
  - `inventarios`: 1.824 auditorias de inventário de lojas.
  - `dFilial`: 232 filiais ativas cadastradas.

### Tempos de Resposta da API REST (Latência Real Medida)
| Endpoint | Finalidade Analítica | Tempo de Resposta (Atlas M0) |
|---|---|---|
| `/api/meta/filtros` | Metadados e opções de filtros encadeados | **251 ms** |
| `/api/overview/kpis` | 7 KPIs executivos e perdas globais | **145 ms** |
| `/api/overview/serie-mensal` | Série histórica de faturamento vs perdas | **162 ms** |
| `/api/overview/mix-av` | Proporção de vendas normais vs a vencer | **123 ms** |
| `/api/excesso/kpis` | Volume e custo do capital imobilizado | **23 ms** |
| `/api/excesso/treemap` | Hierarquia de lojas com excesso por supervisor | **27 ms** |
| `/api/excesso/por-categoria` | Composição de excesso em 3 faixas por categoria | **223 ms** |
| `/api/ruptura/kpis` | Indicadores de autonomia e ruptura consumada | **21 ms** |
| `/api/ruptura/distribuicao` | Donut com as 4 faixas de autonomia de estoque | **24 ms** |
| `/api/score/kpis` | Métricas de risco e total de itens com ação | **23 ms** |
| `/api/score/distribuicao` | Distribuição de SKUs por classificação de risco | **21 ms** |
| `/api/score/acoes` | Contagem por diretriz operacional recomendada | **36 ms** |
| `/api/vendas-av/kpis` | Indicadores de conversão de produtos a vencer | **95 ms** |
| `/api/vendas-av/evolucao` | Evolução temporal de vendas AV | **89 ms** |
| `/api/inventario/kpis` | KPIs de acuracidade média e divergência líquida | **80 ms** |
| `/api/inventario/evolucao` | Curva histórica de conformidade de inventário | **16 ms** |

*Tempo médio de resposta global da API: **~75 ms** (Meta de aceitação: < 500 ms).*

### Testes Automatizados
- **Vitest Backend:** 30 testes unitários e de integração cobrindo 100% das rotas analíticas, paginação, filtros e tratamento de erros (`30 passed`).
- **Build Frontend:** Compilação do Vite concluída sem warnings críticos em **51,5 segundos** com chunks otimizados para carregamento instantâneo.
- **QA Ponta a Ponta Visual:** As 7 telas validadas no navegador automatizado com renderização íntegra de gráficos Recharts, Nivo e tabelas MUI X DataGrid.

---

## 📄 Licença
Distribuído sob a licença **MIT**. Consulte [`LICENSE`](file:///e:/programing/DADOS/Prevenção%20Perdas/LICENSE) para mais informações.
