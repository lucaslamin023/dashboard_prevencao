import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { useSelector } from 'react-redux';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

import KpiCard from '../../components/KpiCard.jsx';
import ChartCard from '../../components/ChartCard.jsx';
import ServerDataGrid from '../../components/ServerDataGrid.jsx';
import RiskChip from '../../components/RiskChip.jsx';
import ExportButton from '../../components/ExportButton.jsx';
import ScoreDetailDrawer from './ScoreDetailDrawer.jsx';
import {
  useGetScoreKpisQuery,
  useGetScoreDistribuicaoQuery,
  useGetScoreAcoesQuery,
  useGetScoreHeatmapQuery,
  useGetScoreTabelaQuery,
} from '../../state/api.js';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from '../../utils/format.js';

export default function ScoreAuditoria() {
  const filters = useSelector((state) => state.filters);

  // Filtros internos da tela
  const [busca, setBusca] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [grupo, setGrupo] = useState('');
  const [acao, setAcao] = useState('');

  // Controle do Drawer explicativo
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Paginação e ordenação
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'Score_Auditoria', sort: 'desc' }]);

  const queryParams = { ...filters };
  delete queryParams.mode;

  const tabelaParams = {
    ...queryParams,
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    sort: sortModel[0]?.field || 'Score_Auditoria',
    order: sortModel[0]?.sort || 'desc',
    q: busca || undefined,
    classificacao: classificacao || undefined,
    grupo: grupo || undefined,
    acao: acao || undefined,
  };

  const { data: kpis, isLoading: loadingKpis } = useGetScoreKpisQuery(queryParams);
  const { data: distribuicao, isLoading: loadingDist } = useGetScoreDistribuicaoQuery(queryParams);
  const { data: acoes, isLoading: loadingAcoes } = useGetScoreAcoesQuery(queryParams);
  const { data: heatmapData, isLoading: loadingHeatmap } = useGetScoreHeatmapQuery(queryParams);
  const { data: tabelaData, isLoading: loadingTabela } = useGetScoreTabelaQuery(tabelaParams);

  const handleRowClick = (params) => {
    setSelectedProduct({ filial: params.row.filial, codigo: params.row.codigo });
    setDrawerOpen(true);
  };

  const columns = [
    { field: 'codigo', headerName: 'Código', width: 90 },
    { field: 'nome', headerName: 'Descrição do Produto', flex: 1.4, minWidth: 200 },
    { field: 'filial', headerName: 'Filial', width: 80 },
    { field: 'grupo', headerName: 'Grupo', width: 90 },
    { field: 'categoria', headerName: 'Categoria', width: 130 },
    {
      field: 'score',
      headerName: 'Score',
      width: 100,
      renderCell: (params) => (
        <span style={{ fontWeight: 800, color: '#22D3EE' }}>
          {(params.value || 0).toFixed(3)}
        </span>
      ),
    },
    {
      field: 'classificacao',
      headerName: 'Classificação',
      width: 150,
      renderCell: (params) => <RiskChip label={params.value} size="small" />,
    },
    {
      field: 'acao',
      headerName: 'Ação Recomendada',
      flex: 1.2,
      minWidth: 220,
      renderCell: (params) => (
        <Typography variant="caption" fontWeight={600} noWrap title={params.value}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'estoque',
      headerName: 'Estoque (UN)',
      width: 120,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatNumber(val) : '—';
      },
    },
    {
      field: 'valor_estoque',
      headerName: 'Estoque (R$)',
      width: 130,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatCurrency(val) : '—';
      },
    },
    {
      field: 'dias_cobertura',
      headerName: 'Cobertura',
      width: 110,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? `${val} d` : '—';
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2" fontWeight={800} gutterBottom>
            Score de Auditoria & Ações Recomendadas
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Mecanismo explicável ponderado sobre 9 vetores de risco + bônus de categoria. Clique em qualquer linha para abrir a decomposição detalhada.
          </Typography>
        </Box>
      </Box>

      {/* Grid de 5 KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Alto Risco"
            value={formatNumber(kpis?.aud_alto)}
            badge={formatPercent(kpis?.perc_alto_medio_alto)}
            subtitle="Alto + Médio-Alto"
            icon={WarningAmberIcon}
            color="#EF4444"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Médio-Alto Risco"
            value={formatNumber(kpis?.aud_medio_alto)}
            subtitle="Faixa de alerta primária"
            icon={WarningAmberIcon}
            color="#F97316"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Score Médio"
            value={(kpis?.score_medio || 0).toFixed(3)}
            subtitle="Escala de 0,000 a 1,100"
            icon={FactCheckIcon}
            color="#22D3EE"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Estoque em Alto Risco"
            value={formatCurrency(kpis?.valor_estoque_aud_alto)}
            subtitle="Capital sob perigo iminente"
            icon={MonetizationOnIcon}
            color="#F43F5E"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Itens com Ação Ativa"
            value={formatNumber(kpis?.n_com_acao)}
            badge={formatPercent(kpis?.perc_com_acao)}
            subtitle="Com plano de remanejamento"
            icon={AssignmentTurnedInIcon}
            color="#10B981"
            loading={loadingKpis}
          />
        </Grid>
      </Grid>

      {/* Linha de Gráficos: Donut por Classificação e Ações Recomendadas */}
      <Grid container spacing={2}>
        {/* Gráfico 1: Donut de Classificação */}
        <Grid item xs={12} lg={4}>
          <ChartCard
            title="Portfólio por Faixa de Score"
            subtitle="Distribuição percentual conforme regras de corte de auditoria"
            loading={loadingDist}
            height={360}
          >
            <ResponsivePie
              data={distribuicao || []}
              margin={{ top: 20, right: 30, bottom: 40, left: 30 }}
              innerRadius={0.62}
              padAngle={2}
              cornerRadius={4}
              activeOuterRadiusOffset={6}
              colors={{ datum: 'data.color' }}
              borderWidth={1}
              borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
              enableArcLinkLabels={false}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor="#FFFFFF"
              arcLabel={(d) => `${formatPercent(d.data.perc)}`}
              theme={{
                tooltip: {
                  container: {
                    background: '#1E293B',
                    color: '#F8FAFC',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #334155',
                  },
                },
              }}
            />
          </ChartCard>
        </Grid>

        {/* Gráfico 2: Ranking de Ações Recomendadas */}
        <Grid item xs={12} lg={8}>
          <ChartCard
            title="Diretrizes Operacionais Recomendadas"
            subtitle="Clique em qualquer barra para filtrar automaticamente a tabela abaixo"
            loading={loadingAcoes}
            height={360}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={acoes || []}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="acao"
                  stroke="#94A3B8"
                  fontSize={10}
                  width={150}
                  tickFormatter={(val) => (val.length > 22 ? `${val.substring(0, 20)}...` : val)}
                />
                <Tooltip
                  formatter={(val) => [formatNumber(val) + ' ocorrências', 'Volume']}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderColor: '#334155',
                    borderRadius: 8,
                    color: '#F8FAFC',
                  }}
                />
                <Bar
                  dataKey="qtd"
                  fill="#22D3EE"
                  radius={[0, 4, 4, 0]}
                  onClick={(data) => {
                    if (data?.acao) {
                      setAcao(data.acao);
                    }
                  }}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Heatmap Categoria x Região */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ChartCard
            title="Mapa de Calor: Score Médio (Categoria × Região)"
            subtitle="Identificação de zonas geográficas com maior fragilidade de validade por linha de produto"
            loading={loadingHeatmap}
            height={320}
          >
            {heatmapData?.length > 0 ? (
              <ResponsiveHeatMap
                data={heatmapData}
                margin={{ top: 30, right: 30, bottom: 50, left: 140 }}
                valueFormat=">-.3f"
                axisTop={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: '',
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'Categoria',
                  legendPosition: 'middle',
                  legendOffset: -120,
                }}
                colors={{
                  type: 'sequential',
                  scheme: 'blues',
                }}
                emptyColor="#334155"
                borderWidth={1}
                borderColor="#1E293B"
                theme={{
                  axis: {
                    ticks: { text: { fill: '#94A3B8', fontSize: 11 } },
                    legend: { text: { fill: '#CBD5E1', fontSize: 12, fontWeight: 600 } },
                  },
                  tooltip: {
                    container: {
                      background: '#1E293B',
                      color: '#F8FAFC',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #334155',
                    },
                  },
                }}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">Sem dados para mapa de calor</Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Tabela de Auditoria com Filtros e Exportação */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Tabela de Auditoria de Produtos (Clique na linha para ver por que este score)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Auditoria individual por SKU com regra aplicada e prazo de validade.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                id="input-busca-score"
                size="small"
                placeholder="Buscar SKU ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 200 }}
              />

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="filtro-score-class-label">Classificação</InputLabel>
                <Select
                  labelId="filtro-score-class-label"
                  id="filtro-score-class"
                  value={classificacao}
                  label="Classificação"
                  onChange={(e) => setClassificacao(e.target.value)}
                >
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  <MenuItem value="Alto Risco">Alto Risco</MenuItem>
                  <MenuItem value="Médio-Alto Risco">Médio-Alto Risco</MenuItem>
                  <MenuItem value="Médio Risco">Médio Risco</MenuItem>
                  <MenuItem value="Baixo Risco">Baixo Risco</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel id="filtro-score-grupo-label">Grupo</InputLabel>
                <Select
                  labelId="filtro-score-grupo-label"
                  id="filtro-score-grupo"
                  value={grupo}
                  label="Grupo"
                  onChange={(e) => setGrupo(e.target.value)}
                >
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  <MenuItem value="A1A1">A1A1</MenuItem>
                  <MenuItem value="A1A2">A1A2</MenuItem>
                  <MenuItem value="A1C1">A1C1</MenuItem>
                  <MenuItem value="A2A2">A2A2</MenuItem>
                  <MenuItem value="A1D2">A1D2</MenuItem>
                  <MenuItem value="Z0Z0">Z0Z0</MenuItem>
                </Select>
              </FormControl>

              {acao && (
                <Button
                  id="btn-limpar-filtro-acao"
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => setAcao('')}
                  startIcon={<FilterAltOffIcon />}
                >
                  Limpar Ação
                </Button>
              )}

              <ExportButton
                id="btn-export-score"
                endpoint="/score/export"
                filename="score_auditoria.csv"
                label="Exportar Score (CSV)"
                extraParams={{ classificacao, grupo, acao }}
              />
            </Box>
          </Box>

          <ServerDataGrid
            rows={tabelaData?.dados || []}
            columns={columns}
            rowCount={tabelaData?.total || 0}
            loading={loadingTabela}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            onRowClick={handleRowClick}
            autoHeight
          />
        </CardContent>
      </Card>

      {/* Drawer Explicativo ao Clicar na Linha */}
      <ScoreDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedProduct={selectedProduct}
      />
    </Box>
  );
}
