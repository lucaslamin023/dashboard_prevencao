import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import WarningIcon from '@mui/icons-material/Warning';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from 'react-redux';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';
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
import {
  useGetMlKpisQuery,
  useGetMlTopProdutosQuery,
  useGetMlScatterQuery,
  useGetMlTabelaQuery,
} from '../../state/api.js';
import { formatCurrency, formatNumber, formatShortCurrency } from '../../utils/format.js';

export default function RiscoMl() {
  const filters = useSelector((state) => state.filters);

  const [busca, setBusca] = useState('');
  const [categoriaRisco, setCategoriaRisco] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'score_ml', sort: 'desc' }]);

  const queryParams = { ...filters };
  delete queryParams.mode;

  const tabelaParams = {
    ...queryParams,
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    sort: sortModel[0]?.field || 'Score_Risco_Perda_ML',
    order: sortModel[0]?.sort || 'desc',
    q: busca || undefined,
    categoria_risco: categoriaRisco || undefined,
  };

  const { data: kpis, isLoading: loadingKpis } = useGetMlKpisQuery(queryParams);
  const { data: topProdutos, isLoading: loadingTop } = useGetMlTopProdutosQuery(queryParams);
  const { data: scatterRaw, isLoading: loadingScatter } = useGetMlScatterQuery(queryParams);
  const { data: tabelaData, isLoading: loadingTabela } = useGetMlTabelaQuery(tabelaParams);

  // Formata dados para o Nivo ScatterPlot agrupado por Categoria de Risco
  const scatterGroups = [
    { id: 'Crítico', data: [], color: '#E11D48' },
    { id: 'Alto', data: [], color: '#EF4444' },
    { id: 'Médio', data: [], color: '#EAB308' },
    { id: 'Baixo', data: [], color: '#10B981' },
  ];

  if (scatterRaw && Array.isArray(scatterRaw)) {
    scatterRaw.forEach((pt) => {
      const g = scatterGroups.find((grp) => grp.id === pt.categoria_risco) || scatterGroups[3];
      if (pt.x !== undefined && pt.x !== null && pt.y !== undefined && pt.y !== null) {
        g.data.push({
          x: Number(pt.x) || 0,
          y: Number(pt.y) || 0,
          nome: pt.nome || 'Produto',
          codigo: pt.codigo,
          filial: pt.filial,
          score: pt.score_ml || 0,
        });
      }
    });
  }

  const validScatterGroups = scatterGroups.filter((g) => g.data.length > 0);

  const columns = [
    { field: 'codigo', headerName: 'Código', width: 90 },
    { field: 'nome', headerName: 'Descrição do Produto', flex: 1.5, minWidth: 200 },
    { field: 'filial', headerName: 'Filial', width: 80 },
    { field: 'nome_filial', headerName: 'Unidade', width: 140 },
    { field: 'categoria', headerName: 'Categoria', width: 130 },
    {
      field: 'estoque',
      headerName: 'Estoque',
      width: 90,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatNumber(val) : '—';
      },
    },
    {
      field: 'demanda_ponderada',
      headerName: 'Demanda Pond.',
      width: 120,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatNumber(val, 1) : '—';
      },
    },
    {
      field: 'valor_av',
      headerName: 'Valor AV',
      width: 120,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatCurrency(val) : '—';
      },
    },
    {
      field: 'score_ml',
      headerName: 'Score ML',
      width: 110,
      renderCell: (params) => {
        const val = params.value || 0;
        const color = val > 0.7 ? '#EF4444' : val > 0.4 ? '#F59E0B' : '#10B981';
        return <span style={{ color, fontWeight: 700 }}>{val.toFixed(3)}</span>;
      },
    },
    {
      field: 'categoria_risco',
      headerName: 'Classificação',
      width: 130,
      renderCell: (params) => <RiskChip label={params.value} size="small" />,
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header com Selo Experimental */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h2" fontWeight={800}>
              Risco Preditivo (Machine Learning)
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Modelo preditivo supervisionado (Random Forest) calibrado sobre volume de perdas históricas e descompasso de vendas AV.
          </Typography>
        </Box>
      </Box>

      {/* Grid de 4 KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Risco Crítico"
            value={formatNumber(kpis?.ml_critico)}
            subtitle="Prioridade máxima de perda"
            icon={WarningIcon}
            color="#E11D48"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Risco Alto"
            value={formatNumber(kpis?.ml_alto)}
            subtitle="Atenção operacional"
            icon={PsychologyIcon}
            color="#EF4444"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Valor AV Crítico"
            value={formatCurrency(kpis?.valor_av_ml_critico)}
            subtitle="Estoque a vencer em alto risco"
            icon={AttachMoneyIcon}
            color="#F59E0B"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Score Médio (ML)"
            value={(kpis?.score_ml_medio || 0).toFixed(3)}
            subtitle="Média da base ponderada"
            icon={ScienceIcon}
            color="#8B5CF6"
            loading={loadingKpis}
          />
        </Grid>
      </Grid>

      {/* Linha de Gráficos: Top 10 e Scatter Plot */}
      <Grid container spacing={2}>
        {/* Top 10 Produtos */}
        <Grid item xs={12} lg={5}>
          <ChartCard
            title="Top 10 Produtos em Risco (ML)"
            subtitle="Itens com maior probabilidade estimada de perda"
            loading={loadingTop}
            height={380}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProdutos || []}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" domain={[0, 1]} stroke="#94A3B8" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  stroke="#94A3B8"
                  fontSize={10}
                  width={110}
                  tickFormatter={(val) => (val.length > 16 ? `${val.substring(0, 14)}...` : val)}
                />
                <Tooltip
                  formatter={(val) => [val.toFixed(3), 'Score ML']}
                  labelFormatter={(_, arr) => arr[0]?.payload?.nome || ''}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderColor: '#334155',
                    borderRadius: 8,
                    color: '#F8FAFC',
                  }}
                />
                <Bar dataKey="score_ml" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Scatter Plot */}
        <Grid item xs={12} lg={7}>
          <ChartCard
            title="Dispersão: Demanda Ponderada × Valor AV"
            subtitle="Correlação entre velocidade de saída e capital imobilizado a vencer (amostra de 2.000 pts)"
            loading={loadingScatter}
            height={380}
          >
            {validScatterGroups.length > 0 ? (
              <ResponsiveScatterPlot
                data={validScatterGroups}
                margin={{ top: 20, right: 30, bottom: 50, left: 60 }}
                xScale={{ type: 'linear', min: 0, max: 'auto' }}
                yScale={{ type: 'linear', min: 0, max: 'auto' }}
                blendMode="normal"
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  orient: 'bottom',
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'Demanda Ponderada (un/mês)',
                  legendPosition: 'middle',
                  legendOffset: 38,
                }}
                axisLeft={{
                  orient: 'left',
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'Valor A Vencer (R$)',
                  legendPosition: 'middle',
                  legendOffset: -50,
                  format: (v) => formatShortCurrency(v),
                }}
                colors={{ datum: 'color' }}
                nodeSize={7}
                tooltip={({ node }) => (
                  <div
                    style={{
                      background: '#1E293B',
                      color: '#F8FAFC',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #334155',
                      fontSize: 12,
                    }}
                  >
                    <strong>{node.data.nome}</strong> (#{node.data.codigo})
                    <br />
                    Filial: #{node.data.filial}
                    <br />
                    Demanda: {node.data.x} un | Valor AV: {formatCurrency(node.data.y)}
                    <br />
                    Score ML: <strong>{node.data.score?.toFixed(3)}</strong>
                  </div>
                )}
                theme={{
                  axis: {
                    ticks: { text: { fill: '#94A3B8', fontSize: 11 } },
                    legend: { text: { fill: '#CBD5E1', fontSize: 12, fontWeight: 600 } },
                  },
                  grid: { line: { stroke: '#334155', strokeWidth: 1, strokeDasharray: '3 3' } },
                }}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                Nenhum ponto de dispersão encontrado para os filtros selecionados.
              </Box>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Tabela de Produtos */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Detalhamento dos Produtos sob Risco de Perda
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Consulte qualquer SKU por nome ou código para avaliar o score estimado pelo algoritmo.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                id="input-busca-ml"
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
                sx={{ width: 220 }}
              />

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="filtro-risco-ml-label">Faixa de Risco</InputLabel>
                <Select
                  labelId="filtro-risco-ml-label"
                  id="filtro-risco-ml"
                  value={categoriaRisco}
                  label="Faixa de Risco"
                  onChange={(e) => setCategoriaRisco(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Todas as faixas</em>
                  </MenuItem>
                  <MenuItem value="Crítico">Crítico</MenuItem>
                  <MenuItem value="Alto">Alto</MenuItem>
                  <MenuItem value="Médio">Médio</MenuItem>
                  <MenuItem value="Baixo">Baixo</MenuItem>
                </Select>
              </FormControl>
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
            autoHeight
          />
        </CardContent>
      </Card>
    </Box>
  );
}
