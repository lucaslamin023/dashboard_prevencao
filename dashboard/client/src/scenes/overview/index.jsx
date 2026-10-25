import React, { useState } from 'react';
import { Box, Grid, Typography, Card, CardContent } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PercentIcon from '@mui/icons-material/Percent';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningIcon from '@mui/icons-material/Warning';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useSelector } from 'react-redux';
import { ResponsivePie } from '@nivo/pie';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

import KpiCard from '../../components/KpiCard.jsx';
import ChartCard from '../../components/ChartCard.jsx';
import ServerDataGrid from '../../components/ServerDataGrid.jsx';
import RiskChip from '../../components/RiskChip.jsx';
import {
  useGetOverviewKpisQuery,
  useGetOverviewSerieMensalQuery,
  useGetOverviewMixAvQuery,
  useGetOverviewFiliaisQuery,
} from '../../state/api.js';
import { formatCurrency, formatPercent, formatNumber, formatShortCurrency } from '../../utils/format.js';

export default function Overview() {
  const filters = useSelector((state) => state.filters);

  // Paginação e ordenação para a tabela de filiais
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'faturamento', sort: 'desc' }]);

  // Query params
  const queryParams = { ...filters };
  delete queryParams.mode;

  const filiaisParams = {
    ...queryParams,
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    sort: sortModel[0]?.field || 'faturamento',
    order: sortModel[0]?.sort || 'desc',
  };

  const { data: kpis, isLoading: loadingKpis } = useGetOverviewKpisQuery(queryParams);
  const { data: serieMensal, isLoading: loadingSerie } = useGetOverviewSerieMensalQuery(queryParams);
  const { data: mixAv, isLoading: loadingMix } = useGetOverviewMixAvQuery(queryParams);
  const { data: filiaisData, isLoading: loadingFiliais } = useGetOverviewFiliaisQuery(filiaisParams);

  // Colunas do DataGrid de Filiais
  const columns = [
    { field: 'filial', headerName: 'Filial', width: 90 },
    { field: 'nome_filial', headerName: 'Nome da Unidade', flex: 1.2, minWidth: 180 },
    { field: 'supervisor', headerName: 'Supervisor', width: 200 },
    { field: 'cidade', headerName: 'Cidade', width: 130 },
    {
      field: 'faturamento',
      headerName: 'Faturamento',
      width: 140,
      valueFormatter: (value) => formatCurrency(typeof value === 'object' && value !== null ? value.value : value),
    },
    {
      field: 'perdas',
      headerName: 'Perdas Totais',
      width: 130,
      valueFormatter: (value) => formatCurrency(typeof value === 'object' && value !== null ? value.value : value),
    },
    {
      field: 'perc_perda',
      headerName: '% Perda',
      width: 100,
      renderCell: (params) => {
        const val = params.value;
        const color = val > 4 ? '#EF4444' : val > 2 ? '#F59E0B' : '#10B981';
        return <span style={{ color, fontWeight: 700 }}>{formatPercent(val)}</span>;
      },
    },
    {
      field: 'perc_excesso',
      headerName: '% Excesso',
      width: 110,
      renderCell: (params) => {
        const val = params.value;
        const color = val > 20 ? '#EF4444' : val > 10 ? '#F59E0B' : '#10B981';
        return <span style={{ color, fontWeight: 700 }}>{formatPercent(val)}</span>;
      },
    },
    {
      field: 'dias_cobertura_medio',
      headerName: 'Cobertura (Dias)',
      width: 130,
      valueFormatter: (value) => {
        const v = typeof value === 'object' && value !== null ? value.value : value;
        return v !== undefined && v !== null ? `${v} d` : '—';
      },
    },
    {
      field: 'status_cobertura',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => <RiskChip label={params.value} size="small" />,
    },
  ];

  // Dados do Donut Composição das Perdas Operacionais
  const totalPerdas = (mixAv?.quebra || 0) + (mixAv?.vencimento || 0) + (mixAv?.inventario || 0);
  const pieData = [
    {
      id: 'Divergência de Inventário',
      label: 'Divergência de Inventário',
      value: mixAv?.inventario || 0,
      color: '#F43F5E',
    },
    {
      id: 'Quebras & Avarias',
      label: 'Quebras & Avarias',
      value: mixAv?.quebra || 0,
      color: '#F59E0B',
    },
    {
      id: 'Perda por Vencimento',
      label: 'Vencimento',
      value: mixAv?.vencimento || 0,
      color: '#8B5CF6',
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Título da Tela */}
      <Box>
        <Typography variant="h2" fontWeight={800} gutterBottom>
          Visão Executiva & Perdas Farmacêuticas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitoramento consolidado de faturamento, perdas operacionais por vencimento, excesso de capital e indicadores de ruptura.
        </Typography>
      </Box>

      {/* Grid de 7 KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Faturamento Total"
            value={formatCurrency(kpis?.faturamento)}
            subtitle="Acumulado no período"
            icon={AttachMoneyIcon}
            color="#10B981"
            loading={loadingKpis}
            sparklineData={kpis?.sparkline_faturamento}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Perdas Operacionais"
            value={formatCurrency(kpis?.perdas)}
            badge={formatPercent(kpis?.perc_perda_faturamento)}
            subtitle="do faturamento"
            icon={TrendingDownIcon}
            color="#F43F5E"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Conversão de Vendas AV"
            value={formatPercent(kpis?.perc_vendas_av)}
            badge="Meta: 80%"
            subtitle="do estoque total a vencer"
            icon={AccessTimeIcon}
            color={(kpis?.perc_vendas_av || 0) >= 80 ? '#10B981' : '#F59E0B'}
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Índice de Excesso"
            value={formatPercent(kpis?.perc_indice_excesso)}
            subtitle="Unidades > 60 dias cob."
            icon={InventoryIcon}
            color="#EAB308"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard
            title="Ruptura Severa"
            value={formatPercent(kpis?.perc_ruptura_severa)}
            subtitle="Consumada + Crítica (< 3d)"
            icon={WarningIcon}
            color="#E11D48"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard
            title="Produtos em Alto Risco (Score)"
            value={formatNumber(kpis?.qtd_alto_risco_score)}
            subtitle="Itens com score de auditoria > 0,30"
            icon={VerifiedUserIcon}
            color="#22D3EE"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard
            title="Vendas Normais"
            value={formatPercent(100 - (kpis?.perc_vendas_av || 0))}
            subtitle="Meta de estabilidade: 80%"
            icon={PercentIcon}
            color="#8B5CF6"
            loading={loadingKpis}
          />
        </Grid>
      </Grid>

      {/* Linha de Gráficos: Combo Faturamento x Perdas e Donut Mix AV */}
      <Grid container spacing={2}>
        {/* Gráfico 1: Combo Chart Faturamento x Perdas */}
        <Grid item xs={12} lg={8}>
          <ChartCard
            title="Faturamento × Perdas Operacionais"
            subtitle="Série mensal histórica comparando vendas brutas (colunas) e perdas totais (linha)"
            loading={loadingSerie}
            height={360}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serieMensal || []} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="ano_mes" stroke="#94A3B8" fontSize={11} />
                <YAxis
                  yAxisId="left"
                  stroke="#10B981"
                  fontSize={11}
                  tickFormatter={(v) => formatShortCurrency(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#F43F5E"
                  fontSize={11}
                  tickFormatter={(v) => formatShortCurrency(v)}
                />
                <Tooltip
                  formatter={(val, name) => [
                    formatCurrency(val),
                    name === 'faturamento' ? 'Faturamento' : 'Perdas Totais',
                  ]}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderColor: '#334155',
                    borderRadius: 8,
                    color: '#F8FAFC',
                  }}
                />
                <Legend
                  formatter={(value) => (value === 'faturamento' ? 'Faturamento (R$)' : 'Perdas (R$)')}
                />
                <Bar
                  yAxisId="left"
                  dataKey="faturamento"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  opacity={0.85}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="perdas"
                  stroke="#F43F5E"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#F43F5E' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Gráfico 2: Donut Mix AV */}
        <Grid item xs={12} lg={4}>
          <ChartCard
            title="Composição das Perdas Operacionais"
            subtitle="Distribuição percentual entre quebras/avarias, vencimento e divergência de inventário"
            loading={loadingMix}
            height={360}
          >
            <ResponsivePie
              data={pieData}
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
              arcLabel={(d) => (totalPerdas > 0 ? `${formatPercent((d.value / totalPerdas) * 100)}` : '0%')}
              tooltip={({ datum: { data } }) => (
                <Box sx={{ background: '#1E293B', p: 1.5, borderRadius: 1.5, border: '1px solid #334155', color: '#F8FAFC' }}>
                  <Typography variant="caption" sx={{ color: data.color, fontWeight: 700 }}>
                    {data.id}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatCurrency(data.value)} ({totalPerdas > 0 ? formatPercent((data.value / totalPerdas) * 100) : '0%'})
                  </Typography>
                </Box>
              )}
            />
          </ChartCard>
        </Grid>
      </Grid>

      {/* Matriz por Filial */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Matriz de Performance por Filial
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Acompanhamento unitário de vendas, taxa de descarte/perda e cobertura de estoque das 232 unidades.
          </Typography>

          <ServerDataGrid
            rows={filiaisData?.dados || []}
            columns={columns}
            rowCount={filiaisData?.total || 0}
            loading={loadingFiliais}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            getRowId={(row) => row.filial}
            autoHeight
          />
        </CardContent>
      </Card>
    </Box>
  );
}
