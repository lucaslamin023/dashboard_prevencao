# 🛡️ Plano de Implementação — Dashboard Web de Prevenção de Perdas (MERN)

> **Destinatário:** LLM/engenheiro implementador. Execute as fases **na ordem**; cada fase termina com **critérios de aceite** verificáveis. Não avance sem cumpri-los.
> **Idioma:** UI, textos de negócio e nomes de colunas em **pt-BR**; código/identificadores técnicos em inglês quando não houver termo de negócio.

---

## 0. Contexto, diagnóstico e decisões

### 0.1 Entradas existentes (somente leitura)
| Item | Uso |
|---|---|
| `Dados_Anonimizados/*.csv` (12 tabelas) | Fonte. **Não alterar**; Power BI continua válido |
| `Anonimização/etl_anonymize.py` | Gerador original (seed 42) — referência de distribuições |
| `gerar_indicadores_ml.py` | 3 indicadores atuais (Ruptura, Excesso, ML RandomForest) |
| `README_PowerBI.md` | Especificação das 4 telas e medidas DAX (**fonte funcional do dashboard**) |
| `Score_Risco_Perda(1).ipynb` | Origem do novo indicador **Score de Auditoria** |

### 0.2 Problemas encontrados na base atual (a Fase 1 corrige)
| # | Achado | Impacto |
|---|---|---|
| P1 | `fEstoqueDemanda`: apenas **168 de 232** filiais; **3.211 pares** (Filial, Produto) duplicados | KPIs por filial incompletos; chave não única |
| P2 | Fatos gerados **independentemente**: pares `fAVencer`×estoque = 2.026 de 71k; `fVendas`×estoque = 2.902 de 250k | Joins quase vazios → indicadores ML/score degenerados |
| P3 | `Demanda_Atual ≥ 1` e `Estoque_Atual ≥ 1` sempre | Sem “sem demanda” nem **Ruptura Consumada** (`Status_Ruptura` atual: 440k “Sem Risco”, 7 “Crítico”, 0 ruptura) |
| P4 | `fAVencer.Vencimento` de 2008 a 2226; `Resolvido` sempre “NÃO”; Comprador/Fornecedor aleatórios (≠ `dProdutos`) | Prazos de validade inválidos |
| P5 | Datas até 2026-12-31 (futuro) em vendas/perdas | “Última venda” e séries mensais inconsistentes |
| P6 | `fPerdasTotais.Quantidade` ∈ {1,2} | Tendência de perda (limiar 0,05) sempre 0 |
| P7 | `fResultadoInventario.csv` usa `;` como separador (demais `,`) | Parser quebra |
| P8 | Faltam campos exigidos pelo score: `Grupo` (A1A1…), última venda/entrada, categoria compatível | Score inviável sem criá-los |
| P9 | ML atual tem **vazamento de alvo** (alvo derivado de `Qtd_AV`/`Valor_Perdas`, que também são features → acurácia 99,87%) | Não expandir; rotular como “indicador experimental” na UI |

### 0.3 Decisões já tomadas (assuma; só altere se o usuário vetar)
| Tema | Decisão |
|---|---|
| Novo indicador | **4º indicador “Score de Auditoria”** (regra ponderada, explicável), convive com o ML (`Score_Risco_Perda_ML`) |
| Data de corte | `DATA_REFERENCIA = 2026-09-30` (substitui `hoje`/“mês anterior” do notebook); linhas > data são descartadas na consolidação |
| Banco | **MongoDB Atlas M0** (512 MB). Dados ficam **fora do Git**; carga via script Python local |
| Performance | Dashboard lê **cubos pré-agregados** (Mongo); detalhes vêm de `indicadores` paginado |
| Stack front | React 18 + **Vite** (CRA descontinuado) + MUI v5 + Redux Toolkit/RTK Query + Nivo + MUI X DataGrid (estrutura inspirada em `ed-roh/fullstack-admin`: `scenes/`, `components/`, `state/`, `theme.js`). JavaScript (sem TypeScript) |
| Gráficos | Nivo em tudo, **exceto** o combo Faturamento×Perdas (eixo secundário) → Recharts `ComposedChart` |
| Auth | **Sem autenticação** (dados sintéticos, somente leitura) + helmet, CORS restrito, rate-limit |
| Deploy | Render: **Static Site** (client) + **Web Service** (API) via `render.yaml`; plano free |
| Fora de escopo | Telas de inventário/bonificação (`fDivergencias*`, `fResultado*`, `fBonificacao`); ficam só no ETL |

### 0.4 Segurança (obrigatório antes de qualquer commit)
1. O notebook contém **usuário/senha/host Oracle em texto puro**, caminhos de rede e nomes internos. **Nunca** copiar queries SQL, credenciais ou caminhos para o repositório. Recomende ao usuário **rotacionar essa senha**.
2. `.gitignore` deve incluir: `Bases/`, `Dados_Anonimizados/`, `Dados_Consolidados/`, `*.xlsx`, `Score_Risco_Perda*.ipynb`, `.env*`, `node_modules/`, `dist/`, `__pycache__/`.
3. Segredos (`MONGO_URL`) apenas em `.env` local e variáveis do Render (`sync: false`).

---

## 1. Arquitetura-alvo

```
Prevenção Perdas/
├─ etl/                          # Python 3.11+
│  ├─ config.py                  # SEED, DATA_REFERENCIA, PESOS, PESO_CATEGORIA, limiares
│  ├─ consolidar_dados.py        # Fase 1  → Dados_Consolidados/*.csv
│  ├─ indicadores_ml.py          # lógica de gerar_indicadores_ml.py parametrizada
│  ├─ regras_acao.py             # Fase 2: regras de ação (tabela §3.4)
│  ├─ score_auditoria.py         # Fase 2: score (§3.3)
│  ├─ gerar_indicadores.py       # orquestra ML + Score → fIndicadores_ML.csv
│  ├─ carregar_mongo.py          # Fase 3: cubos, índices, carga
│  ├─ validar.py                 # asserts de invariantes (§2.2, §3.6)
│  └─ requirements.txt
├─ dashboard/
│  ├─ server/  (Node 20, Express, Mongoose)
│  └─ client/  (Vite + React)
├─ render.yaml  ·  .gitignore  ·  README.md (atualizar)
```

Fluxo: `Dados_Anonimizados` → **consolidar** → `Dados_Consolidados` → **indicadores (ML + Score)** → **carregar_mongo** (Atlas) → **API Express** → **React**.

---

## 2. FASE 1 — Consolidação da base anonimizada

**Entrega:** `etl/consolidar_dados.py` (determinístico, `SEED=42`) lendo `Dados_Anonimizados/` e gravando em `Dados_Consolidados/` (CSV UTF-8 com BOM, separador `,`, mesmos nomes de arquivo/colunas + novas colunas abaixo). Rodar apenas com `pandas/numpy`.

### 2.1 Transformações (nesta ordem)
1. **Universo (Filial, Produto)** — base: `fEstoqueDemanda`.
   - Deduplicar somando `Estoque_Atual`, `Demanda_Atual`, `Demanda_Ponderada` (P1).
   - Completar as 64 filiais ausentes (1..232) criando ~2.600 pares por filial por reamostragem (bootstrap) dos valores existentes e produtos sorteados sem reposição.
   - ~20% dos pares: `Demanda_Atual = 0` e `Demanda_Ponderada = U(0;1,5)` (P3).
   - ~1,5% dos pares adicionais com `Estoque_Atual = 0` e `Demanda_Atual > 0` → **Ruptura Consumada** (essas linhas **não** entram no Score; ver §3.3).
   - Recalcular `Demanda_Rede = soma(Demanda_Atual)` por produto.
   - Demais fatos **só referenciam pares do universo**.
2. **`dProdutos`** — adicionar colunas `Grupo` e `MG`:
   - `Principio_Ativo != 'N/A (Cosmético)'` → `Grupo ∈ {A1A1 30%, A1A2 25%, A2A2 20%, A1C1 15%, A1D2 10%}`; demais → `Z0Z0`.
   - `MG` = regex `(\d+[.,]?\d*(?:/\d+[.,]?\d*)*)\s*(?:mg|mcg|g)\b` (case-insens.) em `Nome_Produto`, vírgula→ponto, **somente** se `Grupo` começa com “A”; senão `""`.
3. **`dFilial`**: manter. **`dCalendario`**: truncar em `DATA_REFERENCIA`.
4. **`fAVencer`**: manter nº de linhas; reatribuir `(Filial, Produto)` a pares do universo com `Estoque_Atual>0`; `Estoque` do lote ≤ `Estoque_Atual` do par e soma por par ≤ estoque; `Comprador`/`Fornecedor` herdados de `dProdutos`; `Custo_Unitario = Custo_Referencia`; `Total_AV = Estoque × Custo_Unitario`; `Preco_Venda = custo × U(1,3;2,2)`; `Resolvido` = “SIM” 15% / “NÃO” 85%; `Vencimento` ∈ [REF−30d, REF+540d] (10% vencidos recentes, 40% 0–90d, 30% 90–240d, 20% 240–540d) (P4).
5. **`fVendas`**: manter 250k linhas e 80/20 (`Is_Venda_AV`); pares sorteados do universo com probabilidade ∝ `Demanda_Atual` (vendas AV somente em pares com lote em `fAVencer`); `Data_Venda ∈ [2023-01-01, REF]`; manter faixas de preço atuais.
6. **`fPerdasTotais`**: pares do universo (concentrar em ~25% dos pares); `Emissao_Data ∈ [2023-01-01, REF]`; `Quantidade` inteira log-normal (média ≈ 3, p95 ≈ 15); em ~30% dos produtos aplicar **tendência crescente** ao longo dos meses (P6); `Custo = Custo_Referencia × U(0,15;0,35)`; `Valor_Perda = Quantidade × Custo`. **Calibrar nº de linhas/custo** para respeitar o invariante I5.
7. **`fMovimentacao` (nova)**: `Filial, Codigo_Produto, Ultima_Venda, Ultima_Entrada` para todos os pares com estoque>0:
   - `Ultima_Venda`: se `Demanda_Atual>0` → REF − `randint(0,30)`d; senão 12% nulo (“nunca vendeu”) e 88% → REF − (31 + Exp(120))d (máx. 3 anos). Se existir venda em `fVendas`, usar `max(venda_sintética, venda_real)` (≤ REF).
   - `Ultima_Entrada`: REF − `randint(5,420)`d; 3% nulo.
8. **`fDivergenciasInventario`**: reatribuir pares ao universo (alimenta feature ML); datas ≤ REF. **`fResultadoInventario`/`fBonificacao`**: reexportar com `,` (P7), datas ≤ REF.

### 2.2 Invariantes (validados em `etl/validar.py`, exit code ≠ 0 se falhar)
| ID | Invariante |
|---|---|
| I1 | `(Filial, Codigo_Produto)` único em `fEstoqueDemanda`; 232 filiais presentes |
| I2 | 100% das chaves de `fAVencer`, `fVendas`, `fPerdasTotais`, `fMovimentacao`, `fDivergencias` existem no universo; todas as FKs existem nas dimensões |
| I3 | Nenhuma data > `DATA_REFERENCIA`; `Vencimento` ∈ [2026-08-31; 2028-03-31] |
| I4 | `Resolvido` contém SIM e NÃO; soma `fAVencer.Estoque` por par ≤ `Estoque_Atual` |
| I5 | Perdas/Faturamento mensal ≤ **3%** em todos os meses com vendas |
| I6 | ≥ 5% dos pares com perdas têm `|tendência| ≥ 0,05` (§3.3) |
| I7 | Participação: `Demanda_Atual=0` ∈ [15%;25%]; `Estoque=0` ∈ [1%;2,5%]; vendas AV = 20% ±1pp |

**Aceite Fase 1:** `python etl/consolidar_dados.py && python etl/validar.py --fase 1` passa; `Dados_Anonimizados/` intacto (hash inalterado).

---

## 3. FASE 2 — Indicadores: ML existente + **Score de Auditoria**

### 3.1 Refatoração
- Migrar `gerar_indicadores_ml.py` para `etl/indicadores_ml.py` (lógica idêntica; `DATA_DIR = Dados_Consolidados`). Manter `Status_Ruptura`, `Nivel_Excesso`, `Qtd_Estoque_Excesso`, `Indice_Excesso_Filial_Perc`, `Score_Risco_Perda_ML`, `Categoria_Risco_Perda`.
- Adicionar colunas: `Valor_Estoque_Custo = Estoque_Atual × Custo_Referencia`, `Valor_Excesso_Custo = Qtd_Estoque_Excesso × Custo_Referencia` (alimenta “Custo de Capital Imobilizado”).
- `gerar_indicadores.py` junta ML + Score e grava **`Dados_Consolidados/fIndicadores_ML.csv`** (mantém o nome por compatibilidade com o Power BI).

### 3.2 Escopo do Score
Linhas com `Estoque_Atual > 0` (replica `NVL(b2_qatu,0) > 0` do notebook). Linhas com estoque 0 recebem `Score_Auditoria = null`.

### 3.3 Especificação do Score (vetorizar com pandas; **sem** `apply` por linha nas etapas numéricas)

**Mapeamento notebook → base anonimizada**
| Notebook | Base consolidada |
|---|---|
| Estoque Atual / Demanda Atual / Demanda Rede | `Estoque_Atual` / `Demanda_Atual` / `Demanda_Rede` |
| custo | `dProdutos.Custo_Referencia` |
| Ultima venda / Ultima Entrada | `fMovimentacao` |
| total_a_vencer_cadastrado_intranet | Σ `fAVencer.Estoque` do par com `Resolvido='NÃO'`, limitado a `Estoque_Atual` |
| qtd_perdida_ano | Σ `fPerdasTotais.Quantidade` do par em [REF−365d; REF] |
| TENDENCIA_NUM | ver passo T abaixo |
| qtd_vendida_maior_filial / “Maior venda” | `max(Demanda_Atual)` do produto na rede / filial do máximo |
| vendas_filial_atual / vendas_rede | `Demanda_Atual` / `Demanda_Rede` (proxy) |
| vendas princípio ativo (filial/rede) | Σ `Demanda_Atual` por (Filial, `Principio_Ativo`, `MG`) / por (`Principio_Ativo`, `MG`) |
| b1_grupo / Categoria | `dProdutos.Grupo` / `dProdutos.Categoria` |
| prazo_validade_meses | `(ano_venc−ano_REF)*12 + (mês_venc−mês_REF)` do **menor** `Vencimento` dos lotes `Resolvido='NÃO'` do par; `NaN` se não houver lote |

**Passo T (tendência, nível produto)**: nas perdas da janela de 365 d, `MES` = 1º dia do mês de `Emissao_Data`; `x` = dias desde o menor `MES` do **produto**; `y` = `Quantidade`; `slope` = coeficiente da regressão linear por produto (fórmula fechada `cov/var`; 0 se <2 pontos ou `var(x)=0`); zerar se `|slope| < 0,05`; `Tendencia_Perda` do par = slope do produto se o par tiver perdas, senão 0.

**Features (por linha com estoque>0)**
```
meses_desde_ultima_venda  = (REF - Ultima_Venda).dias/30, ou 36 se nunca vendeu; clip(max=12)
meses_desde_ultima_entrada= (REF - Ultima_Entrada).dias/30, ou 36 se nunca entrou; clip(max=12)
se meses_desde_ultima_entrada < 4: meses_desde_ultima_venda = 1
dias_desde_ultima_entrada = (REF - Ultima_Entrada).dias ; nulo/nunca → 365 ; clip(max=365)   # [D5]
proporcao_a_vencer        = total_a_vencer / Estoque_Atual
proporcao_perda           = qtd_perdida_ano / Estoque_Atual
estoque_sobre_demanda     = Estoque_Atual / (Demanda_Atual se != 0 senão 1)
estoque_sobre_demanda_log = log1p(estoque_sobre_demanda)
venda_max_log             = log1p(qtd_vendida_maior_filial / Estoque_Atual)
demanda_rede_log          = log1p(Demanda_Rede / Estoque_Atual)
custo_total_estoque       = Estoque_Atual * custo
```
**Pesos** (`config.PESOS`, soma = 1,0):
| Feature | Peso |
|---|---|
| meses_desde_ultima_venda | 0,22 |
| estoque_sobre_demanda_log | 0,15 |
| proporcao_a_vencer | 0,13 |
| proporcao_perda | 0,13 |
| custo_total_estoque | 0,13 |
| TENDENCIA_NUM | 0,08 |
| venda_max_log | 0,065 |
| demanda_rede_log | 0,065 |
| dias_desde_ultima_entrada | 0,03 |

**Cálculo**
1. NaN→0. Normalizar cada feature por **min-max dentro de (Filial, Categoria)** (`max==min` → 0). Para `TENDENCIA_NUM`: min-max **apenas entre valores ≠ 0**, zeros permanecem 0 **[D2]**.
2. `Score_Base = Σ peso × feature_norm`. Se `nunca vendeu` e `Score_Base == 0` → `0,4`.
3. `Classificacao_Risco_Auditoria` sobre `Score_Base`: `<0,10` **Baixo Risco** · `<0,20` **Médio Risco** · `<0,30` **Médio-Alto Risco** · `≥0,30` **Alto Risco** **[D1]**.
4. Bônus de categoria: `peso_categoria_norm` = min-max global de `PESO_CATEGORIA[Categoria]`; `Score_Auditoria = Score_Base + 0,10 × peso_categoria_norm` **apenas** se classe ∈ {Médio-Alto, Alto}; a classificação **não** é recalculada (comportamento original).
5. `Risco_Demanda_Venda` (usa `Score_Auditoria`): `est_dem_rede = Estoque/(Demanda_Rede ou 1)`; `prop_top = qtd_vendida_maior_filial/(Demanda_Rede ou 1)`:
   - `score ≥ 0,25` e `est_dem_rede > 6` → **Altíssimo Risco** se `prop_top < 0,4`, senão **Alto Risco**
   - `score ≥ 0,20` e `est_dem_rede > 4` → **Moderado** · caso contrário **Baixo**
6. `Contrib_<feature> = peso × feature_norm` (9 colunas) e `Contrib_Categoria` (bônus). Explicação textual é gerada **na API** (só contribuições > 0,02).
7. `Acao_Recomendada` conforme §3.4 (somente se `Score_Auditoria > 0,10`).
8. `Produto_Referencia_PA` (só `Grupo` “A…”): “(código) nome” do produto de maior `Demanda_Atual` no mesmo (Filial, `Principio_Ativo`, `MG`) — equivale ao “Colocar por cima do”.

**`config.PESO_CATEGORIA`** (adaptação das categorias reais para as anonimizadas):
| Categoria | Peso |
|---|---|
| Prescrição Médica | 9 |
| Medicamentos Isentos (MIP) | 7 |
| Dermocosméticos | 6 |
| Suplementos & Vitaminas · Primeiros Socorros | 5 |
| Higiene & Cuidados Pessoais · Cosméticos Capilares · Beleza & Maquiagem | 4 |
| Nutrição Esportiva | 3 |
| Mamãe & Bebê | 2 |

### 3.4 Regras de ação (`regras_acao.py`) — fonte: última versão do notebook (célula “regras revisadas”; o módulo `regras3` não existe no repositório)
Aplicar só se `Score_Auditoria > 0,10`; usar o `Grupo` do produto; **primeira condição verdadeira vence**; grupo sem regra → `None`. Comparações com `prazo` `NaN` são falsas.

**Condições** (`vPA_f` = vendas do princípio ativo na filial; `vPA_r` = na rede; `cob = Estoque_Atual/(vPA_f+1)`)
| Código | Condição |
|---|---|
| `sem_validade` | `prazo` é NaN |
| `vender_custo` | `prazo ≤ 2` |
| `cotacao_med` | `vPA_f ≠ 0` e `prazo > 12` e `dias_desde_ultima_venda > 120` e `cob < 2` |
| `reposicionar` | `Demanda_Atual > 0` |
| `transferir` | `Demanda_Atual = 0` e `Demanda_Rede > 0` e `prazo > 10` |
| `igual_generico` | `prazo < 10` e `cob > 2` |
| `transferir_pa` | `prazo < 8` e (`vendas_rede > 0` ou `cob > 2`) |
| `inteligencia` | `Demanda_Atual = 0` e `Demanda_Rede = 0` e `vPA_r = 0` |
| `cotacao_a2a2` | `prazo ≥ 12` e `Demanda_Atual = 0` e `Demanda_Rede = 0` |
| `cotacao_a1d2` | `prazo ≥ 10` e `Demanda_Atual = 0` e `Demanda_Rede = 0` |
| `transf_a2a2` | `prazo ≥ 10` e `Demanda_Atual = 0` e (`vendas_rede > 0` ou `cob > 2`) |
| `transf_a1d2` | `prazo < 10` e `Demanda_Atual = 0` e (`vendas_rede > 0` ou `cob > 2`) |
| `default` | sempre |

**Ações (texto exato exibido na UI)**
| Chave | Texto |
|---|---|
| `sem_validade` | Produto sem validade informada: solicitar à filial o cadastro |
| `vender_custo` | Produto crítico: vender abaixo do custo (última prioridade) |
| `cotacao` | Cotação do produto no mercado e avaliar ajuste de preço |
| `reposicionar` | Reposicionar e priorizar venda / Filial acompanhar a saída do produto |
| `transferir` | Transferir para filial/loja com demanda do SKU |
| `igual_generico` | Igualar a apresentação genérica mais vendida; posicionar o produto acima ou à frente / Filial acompanhar |
| `transferir_pa` | Transferir para filial/loja com demanda do princípio ativo |
| `inteligencia` | Acionar Inteligência de Mercado ou representante do fabricante |
| `default` | O comprador deve comunicar os médicos para gerar prescrição médica e bloquear a compra do produto |

**Ordem por grupo**
| Grupo | Regras (condição → ação) |
|---|---|
| **A1A1, A1A2** | sem_validade → vender_custo → cotacao_med→`cotacao` → reposicionar → transferir → igual_generico → transferir_pa → inteligencia → default |
| **A1C1** | sem_validade → vender_custo → cotacao_med→`cotacao` → reposicionar → inteligencia → transferir *(sem default)* |
| **A2A2** *(2ª definição do notebook prevalece)* | sem_validade → cotacao_a1d2→`cotacao` → transf_a2a2→`transferir_pa` |
| **A1D2** | sem_validade → cotacao_a1d2→`cotacao` → transf_a1d2→`transferir_pa` |
| Outros (`Z0Z0`) | sem ação |

### 3.5 Desvios intencionais do notebook (documentar no README)
| ID | Original | Adotado | Motivo |
|---|---|---|---|
| D1 | Rótulos `'Média Alto Risco'` (classificação) ≠ `'Médio Alto Risco'` (filtro do bônus) → bônus nunca aplicado | Rótulo único “Médio-Alto Risco” | Typo; corrige a intenção |
| D2 | `normalizar(ignorar_zero=True)` devolve a série **sem normalizar** | Min-max nos não-zeros | Bug de `combine_first` |
| D3 | `from regras3 import definir_acao` (módulo externo) | Regras reimplementadas (§3.4) | Reprodutibilidade |
| D4 | “Intranet por vencimento” expande linhas | 1 linha por par com o **menor** vencimento; lotes completos no detalhe | Grão único para o dashboard |
| D5 | `dias_desde_ultima_entrada` sem teto (1900 → ~46.000) | `clip(max=365)` | Evita dominar a normalização |

### 3.6 Metas de distribuição (calibrar **parâmetros de consolidação**, não os pesos)
`Alto Risco` 3–12% · `Médio-Alto` 5–15% · `Baixo Risco` ≥ 50% · `Status_Ruptura`: Ruptura Consumada 1–2,5%, Crítico/Alto Risco 2–6% · `Nivel_Excesso` Elevado+Crítico 10–25% · `Categoria_Risco_Perda` Crítico+Alto 3–15% · ≥ 30% das linhas com `Acao_Recomendada`.

### 3.7 Colunas finais de `fIndicadores_ML.csv`
Existentes (21) + `Grupo, Principio_Ativo, MG, Custo, Demanda_Rede, Ultima_Venda, Ultima_Entrada, Qtd_A_Vencer, Qtd_Perdida_Ano, Tendencia_Perda, Prazo_Validade_Meses, Qtd_Vendida_Maior_Filial, Filial_Maior_Venda, Vendas_PA_Filial, Vendas_PA_Rede, Valor_Estoque_Custo, Valor_Excesso_Custo, Score_Auditoria_Base, Score_Auditoria, Classificacao_Risco_Auditoria, Risco_Demanda_Venda, Acao_Recomendada, Produto_Referencia_PA` + 10 `Contrib_*`.

**Aceite Fase 2:** testes pytest (`etl/tests/`) com fixture de ~200 linhas cobrindo: normalização min-max/zeros, bônus de categoria (D1), classificação nos limiares 0,10/0,20/0,30, caso `nunca vendeu`→0,4, cada regra de ação por grupo, `Score` ∈ [0; 1,10]; `validar.py --fase 2` confirma §3.6; `Contrib_*` somam `Score_Auditoria` (±0,001).

---

## 4. FASE 3 — Carga no MongoDB Atlas (`etl/carregar_mongo.py`)

Conexão por `MONGO_URL` (`.env`, via `python-dotenv`); `pymongo` com `insert_many` em lotes de 10k; idempotente (`drop` + recarga); tipos corretos (datas → `datetime`, números → int/float).

| Coleção | Grão / conteúdo | Docs (aprox.) |
|---|---|---|
| `meta` | 1 doc: `data_referencia`, `pesos`, `peso_categoria`, `versao`, `gerado_em` | 1 |
| `dFilial` | dimensão completa | 232 |
| `indicadores` | 1 por (Filial, Produto) = `fIndicadores_ML` + **desnormalizado**: `Supervisor, Regiao, Estado, Pais, Nome_Filial` | ~450k |
| `avencer` | lotes de `fAVencer` (detalhe do produto) | ~76k |
| `cubo` | (`Filial, Categoria, Comprador`) com **medidas aditivas** (abaixo) | ≤ 23k |
| `cubo_acoes` | (`Filial, Categoria, Comprador, Acao`) → `n` | ≤ 100k |
| `cubo_mensal` | (`Ano_Mes, Filial, Comprador`) → `faturamento, faturamento_av, qtd_vendida, perda_valor, perda_vencimento, perda_qtd` | ≤ 105k |

**Medidas do `cubo`** (todas somáveis; médias = soma/`n`): `n, estoque_un, valor_estoque_custo, excesso_un, valor_excesso_custo, sum_dias_cobertura, rupt_consumada, rupt_critico, rupt_moderado, rupt_sem_risco, ml_critico, ml_alto, ml_medio, ml_baixo, sum_score_ml, valor_av, valor_av_ml_critico, n_score` (linhas com score), `aud_alto, aud_medio_alto, aud_medio, aud_baixo, sum_score_aud, valor_estoque_aud_alto, n_com_acao`.

**Índices**: `indicadores`: `{Filial:1,Codigo_Produto:1}` único · `{Score_Auditoria:-1}` · `{Score_Risco_Perda_ML:-1}` · `{Status_Ruptura:1,Dias_Cobertura:1}` · `{Regiao:1,Estado:1}` · `{Comprador:1,Categoria:1}` · texto em `Nome_Produto`. `cubo*`: `{Filial:1}`, `{Comprador:1}`, `{Categoria:1}`, `{Ano_Mes:1}`. `avencer`: `{Filial:1,Codigo_Produto:1}`.

**Orçamento de armazenamento:** após a carga, `db.stats()` deve ser **≤ 400 MB**. Se exceder: remover de `indicadores` as linhas “sem relevância” (`Score_Auditoria ≤ 0,10` **e** `Status_Ruptura='Sem Risco'` **e** `Nivel_Excesso='Estoque Normal'` **e** ML `Baixo`) — **os cubos continuam calculados sobre 100% das linhas**.

**Aceite Fase 3:** script imprime contagens por coleção; `Σ cubo.n` = nº de linhas do CSV; `Σ cubo_mensal.faturamento` = Σ `fVendas.Valor_Total` (±0,01); tamanho ≤ 400 MB.

---

## 5. FASE 4 — Backend (`dashboard/server`)

**Stack:** Node 20, Express, Mongoose (ou driver nativo), `helmet`, `cors`, `compression`, `morgan`, `express-rate-limit`, `dotenv`; testes: Vitest/Jest + `supertest` + `mongodb-memory-server`.

```
server/src/{index.js, app.js, config/db.js, routes/, controllers/, services/filtros.js, utils/{cache.js,csv.js}}
server/tests/
```
- `app.js` exporta o app (testável); `index.js` conecta e escuta `process.env.PORT`.
- **Filtros globais** (query string, todos opcionais): `regiao, estado, filial, comprador, categoria, dataIni, dataFim (YYYY-MM)`. `services/filtros.js` converte `regiao/estado` em lista de `Filial` (cache em memória de `dFilial`) e monta `$match` único reutilizado por todos os controllers. `dataIni/dataFim` afetam **apenas** `cubo_mensal`; indicadores são **foto em `data_referencia`** (informar na UI).
- Cache em memória (TTL 5 min) para `/meta` e agregações pesadas; erros em JSON `{erro, detalhe?}`; paginação `page` (0-based), `pageSize ≤ 100`, `sort`, `order`.

### Contrato da API (prefixo `/api`)
| Rota | Retorno |
|---|---|
| `GET /health` | `{ok:true}` (sem DB; usado pelo Render) |
| `GET /meta/filtros` | regiões, estados (por região), compradores, categorias, filiais, `data_referencia`, pesos |
| `GET /overview/kpis` | faturamento, perdas R$, % perda/fat., % vendas AV, % índice excesso, % ruptura severa, nº Alto Risco (score) |
| `GET /overview/serie-mensal` | `[{ano_mes, faturamento, perdas}]` |
| `GET /overview/mix-av` | `{normal, av}` |
| `GET /overview/filiais` | tabela paginada: filial, faturamento, perdas, % excesso, status cobertura |
| `GET /risco-ml/kpis` · `/top-produtos` (top 10) · `/scatter` (≤ 2.000 pts: maiores `Valor_AV`) · `/tabela` | Tela ML |
| `GET /excesso/kpis` · `/treemap` (Estado→Filial) · `/por-categoria` (3 níveis) · `/filiais` | Tela Excesso (inclui `valor_excesso_custo`) |
| `GET /ruptura/kpis` · `/distribuicao` · `/tabela` (só Crítico/Ruptura) · `/export` (CSV ≤ 50k linhas) | Tela Ruptura |
| `GET /score/kpis` · `/distribuicao` (classificação) · `/acoes` (por ação) · `/heatmap` (Categoria × Região, score médio) · `/tabela` (filtros `classificacao, grupo, acao, q`) · `/export` (CSV) | Tela Score |
| `GET /score/produto/:filial/:codigo` | detalhe: linha completa, `explicacao[]` (contribuições > 0,02 ordenadas, com valor normalizado e peso), regra de ação, lotes (`avencer`) |

Regras: KPIs via `cubo*` (`$match` + `$group` somas); tabelas/top/scatter via `indicadores` com projeção mínima; `q` numérico = `Codigo_Produto`, texto = `$text`. `Qtd Filiais Excesso Crítico` = filiais com `excesso_un/estoque_un > 15%` após filtros. Fórmulas dos KPIs = medidas DAX do `README_PowerBI.md` (DIVIDE com 0 em divisão por zero).

**Aceite Fase 4:** `npm test` verde (≥ 1 teste por rota + filtros + paginação + 404/validação); resposta típica < 500 ms em Atlas M0 (medir e registrar); `/health` responde sem DB.

---

## 6. FASE 5 — Frontend (`dashboard/client`)

**Setup:** `npm create vite@latest` (template `react`; rodar com `--help` antes), deps: `@mui/material @mui/icons-material @emotion/react @emotion/styled @mui/x-data-grid @reduxjs/toolkit react-redux react-router-dom @nivo/core @nivo/bar @nivo/pie @nivo/scatterplot @nivo/treemap @nivo/heatmap @nivo/line recharts`. Variável: `VITE_API_URL`.

```
client/src/{main.jsx, App.jsx, theme.js, state/{index.js,api.js,filtersSlice.js},
 components/{Layout,Navbar,Sidebar,FilterBar,KpiCard,ChartCard,RiskChip,ServerDataGrid,ExportButton,ApiStatusBanner,EmptyState}/,
 scenes/{overview,riscoMl,excesso,ruptura,score,metodologia}/, utils/format.js}
```

### 6.1 Design system (`theme.js`)
- Dark padrão + toggle claro/escuro (padrão `themeSettings` do fullstack-admin). Fundo `#0F172A`; cards `#1E293B` com borda `#334155` e *glassmorphism* sutil; texto `#F8FAFC`.
- Semântica: Normal/Vendas `#10B981` · Atenção/Excesso `#F59E0B` · Perda/Crítico `#F43F5E` · ML `#8B5CF6` · **Score de Auditoria** ciano `#22D3EE`. Escala de classes: Baixo (verde) → Médio (amarelo) → Médio-Alto (laranja) → Alto (vermelho).
- Fonte Inter (Google Fonts); micro-animações (hover em cards, *skeleton* de carregamento, transições de rota); `Intl` pt-BR para moeda/%/datas; `<title>` e `<meta description>` por rota; IDs únicos em elementos interativos.

### 6.2 Estado e dados
- `state/api.js`: `createApi` (RTK Query) com `baseUrl = import.meta.env.VITE_API_URL` e wrapper de **retry (3x, backoff)** — o plano free do Render “dorme”; `ApiStatusBanner` mostra “Acordando o servidor…” enquanto aguarda.
- `filtersSlice`: `{regiao, estado, filial, comprador, categoria, dataIni, dataFim}` global; **todos** os endpoints recebem esses params. `FilterBar` no Navbar (Autocomplete encadeado Região→Estado) + chip “Foto de dados em 30/09/2026”.

### 6.3 Telas (rotas)
| Rota | Tela | Conteúdo (espelha README_PowerBI + Score) |
|---|---|---|
| `/` | **Executive Overview** | 5 KPIs (+ sparkline faturamento) + KPI “Produtos em Alto Risco (Score)”; combo Faturamento (colunas) × Perdas (linha, eixo 2); donut Normais 80% × AV 20%; matriz por filial (DataGrid servidor) |
| `/risco-ml` | **Risco Preditivo (ML)** | cards Crítico/Alto/Valor AV crítico; barras Top 10 por score; scatter `Demanda_Ponderada × Valor_AV` (tamanho = score, cor = categoria); tabela com degradê verde→vermelho; selo “indicador experimental” |
| `/excesso` | **Excesso por Filial** | cards (estoque, excesso, % índice, filiais críticas); treemap Estado→Filial (tamanho = estoque, cor = % excesso); barras empilhadas Estoque Normal/Elevado/Crítico por categoria; tabela de ação (Filial, Supervisor, Gerente, estoque, excesso UN, **capital imobilizado R$**) |
| `/ruptura` | **Monitor de Ruptura** | cards (dias de cobertura médio, consumada, alto risco, % severa); rosca por status; tabela de ressuprimento (somente Crítico/Ruptura) + botão **Exportar CSV** |
| `/score` | **Score de Auditoria** *(novo)* | cards (Alto Risco, Médio-Alto, score médio, R$ em estoque sob Alto Risco, nº com ação); donut por classificação; barras de ações recomendadas (clicar filtra a tabela); heatmap Categoria×Região; tabela filtrável (classificação, grupo, ação, busca) com `RiskChip`; **clique na linha → Drawer “Por que este score?”**: barras das 9 contribuições + bônus, valores brutos, lotes a vencer e ação recomendada com a regra que a disparou |
| `/metodologia` | Metodologia | texto curto: definição dos 4 indicadores, pesos, limiares, desvios D1–D5, aviso do ML |

Qualidade: layout responsivo (≥ 360 px), estados vazio/erro/carregando em todo gráfico, acessibilidade (contraste AA, `aria-label` nos gráficos, foco visível), `DataGrid` com `paginationMode="server"` (`pageSizeOptions [25,50,100]`).

**Aceite Fase 5:** `npm run build` sem erros/warnings críticos; navegação por todas as rotas contra a API local sem erros de console; verificação visual (screenshots) das 5 telas em dark/light e viewport 1440 px e 390 px; filtros globais alteram KPIs; export CSV baixa arquivo válido; Drawer abre para ao menos 1 linha de cada classe.

---

## 7. FASE 6 — Deploy no Render

1. **Atlas:** cluster M0; usuário de banco dedicado (senha forte); Network Access `0.0.0.0/0` (Render free não tem IP fixo). Rodar `carregar_mongo.py` **localmente** apontando para o Atlas.
2. **`render.yaml`** na raiz (Blueprint):
```yaml
services:
  - type: web
    name: prevencao-api
    runtime: node
    rootDir: dashboard/server
    plan: free
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_VERSION
        value: 20
      - key: MONGO_URL
        sync: false
      - key: CLIENT_URL
        sync: false
  - type: web
    name: prevencao-web
    runtime: static
    rootDir: dashboard/client
    buildCommand: npm ci && npm run build
    staticPublishPath: dist
    envVars:
      - key: VITE_API_URL
        sync: false
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```
3. Ordem: subir **API** → copiar URL → definir `VITE_API_URL` no site → subir **web** → copiar URL → definir `CLIENT_URL` (origem exata, sem `/` final) na API → redeploy. (`VITE_*` é embutida no build: alterar exige novo deploy.)
4. API: `app.listen(process.env.PORT)`, `trust proxy`, CORS somente `CLIENT_URL`, rate-limit 300 req/5 min/IP.

**Aceite Fase 6:** URL pública abre as 5 telas com dados reais; `/api/health` = 200; sem erros CORS; 1ª requisição após inatividade conclui (cold start) mostrando o banner de espera.

---

## 8. FASE 7 — Documentação e QA final
- Atualizar `README.md`: 4 indicadores, nova estrutura, comandos (`python etl/...`, `npm run dev` em `server`/`client`), variáveis de ambiente (`.env.example` em `etl/`, `server/`, `client/`), URL do deploy, desvios D1–D5, limitações (ML com vazamento; dados sintéticos; proxies de vendas).
- Verificação ponta a ponta com navegador automatizado em local e em produção; registrar tempos de resposta e tamanho do banco.

---

## 9. Ordem, dependências e definição de pronto

`F1 → F2 → F3 → (F4 ∥ início F5 com mocks) → F5 → F6 → F7`

**Pronto =** todos os critérios de aceite das fases verdes + `validar.py` (fases 1–2) + `npm test` + build do client + URL do Render funcional + nenhum segredo/dado real no Git.

### Regras para o implementador
1. Não invente colunas/endpoints fora deste plano; se algo faltar, registre a lacuna e escolha a opção mais simples compatível.
2. Fixe versões (`package-lock.json`, `requirements.txt`) e use `SEED=42` em toda geração aleatória.
3. Commits por fase; rodar testes/validações antes de cada commit.
4. Qualquer divergência de §3.3/§3.4 em relação ao notebook deve esta listada em §3.5.
