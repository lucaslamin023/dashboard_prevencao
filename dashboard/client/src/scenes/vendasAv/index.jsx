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
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import { useSelector } from 'react-redux';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

import KpiCard from '../../components/KpiCard.jsx';
import ChartCard from '../../components/ChartCard.jsx';
import ServerDataGrid from '../../components/ServerDataGrid.jsx';
import {
  useGetVendasAvKpisQuery,
  useGetVendasAvEvolucaoQuery,
  useGetVendasAvTopVendedoresQuery,
  useGetVendasAvPorCategoriaQuery,
  useGetVendasAvTabelaQuery,
} from '../../state/api.js';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShortCurrency,
  formatDate,
} from '../../utils/format.js';

export default function VendasAv() {
  const filters = useSelector((state) => state.filters);

  const [busca, setBusca] = useState('');
  const [filtroCusto, setFiltroCusto] = useState('todos');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'data_venda', sort: 'desc' }]);

  const queryParams = { ...filters };
  delete queryParams.mode;

  const tabelaParams = {
    ...queryParams,
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    sort: sortModel[0]?.field || 'data_venda',
    order: sortModel[0]?.sort || 'desc',
    q: busca || undefined,
    abaixo_custo: filtroCusto === 'todos' ? undefined : filtroCusto === 'abaixo' ? 'true' : 'false',
  };

  const { data: kpis, isLoading: loadingKpis } = useGetVendasAvKpisQuery(queryParams);
  const { data: evolucao, isLoading: loadingEvolucao } = useGetVendasAvEvolucaoQuery(queryParams);
  const { data: topVendedores, isLoading: loadingVendedores } = useGetVendasAvTopVendedoresQuery(queryParams);
  const { data: porCategoria, isLoading: loadingCategorias } = useGetVendasAvPorCategoriaQuery(queryParams);
  const { data: tabelaData, isLoading: loadingTabela } = useGetVendasAvTabelaQuery(tabelaParams);

  const columns = [
    { field: 'id_venda', headerName: 'ID Venda', width: 140 },
    {
      field: 'data_venda',
      headerName: 'Data',
      width: 110,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return formatDate(val);
      },
    },
    { field: 'filial', headerName: 'Filial', width: 80 },
    { field: 'nome_filial', headerName: 'Unidade', width: 150 },
    { field: 'vendedor', headerName: 'Vendedor', flex: 1.2, minWidth: 160 },
    { field: 'produto', headerName: 'Produto', flex: 1.5, minWidth: 200 },
    { field: 'categoria', headerName: 'Categoria', width: 130 },
    {
      field: 'quantidade',
      headerName: 'Qtd (UN)',
      width: 95,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatNumber(val) : '—';
      },
    },
    {
      field: 'valor_unitario',
      headerName: 'Preço Venda',
      width: 115,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatCurrency(val) : '—';
      },
    },
    {
      field: 'custo_unitario',
      headerName: 'Custo Ref',
      width: 115,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatCurrency(val) : '—';
      },
    },
    {
      field: 'valor_total',
      headerName: 'Total (R$)',
      width: 125,
      renderCell: (params) => (
        <span style={{ fontWeight: 700, color: '#10B981' }}>
          {formatCurrency(params.value)}
        </span>
      ),
    },
    {
      field: 'is_abaixo_custo',
      headerName: 'Margem Comercial',
      width: 150,
      renderCell: (params) => {
        const abaixo = params.value === 1;
        return (
          <Chip
            label={abaixo ? 'Abaixo do Custo' : 'Margem Positiva'}
            size="small"
            color={abaixo ? 'error' : 'success'}
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
        );
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2" fontWeight={800} gutterBottom>
            Vendas de Produtos A Vencer (AV)
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Acompanhamento temporal da conversão de itens a vencer, metas de liquidação (80%), ranking de vendedores e deságio.
          </Typography>
        </Box>
      </Box>

      {/* Grid de 5 KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Faturamento AV"
            value={formatCurrency(kpis?.faturamento_av)}
            subtitle={`De ${formatCurrency(kpis?.total_av)} a vencer`}
            icon={PointOfSaleIcon}
            color="#10B981"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Taxa de Conversão"
            value={formatPercent(kpis?.perc_conversao_av)}
            badge="Meta: 80%"
            subtitle="Itens a vencer liquidados"
            icon={TrendingUpIcon}
            color={(kpis?.perc_conversao_av || 0) >= 80 ? '#10B981' : '#F59E0B'}
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Volume Liquidado"
            value={formatNumber(kpis?.qtd_vendida_av)}
            subtitle={`${formatNumber(kpis?.transacoes_av)} vendas no período`}
            icon={Inventory2Icon}
            color="#22D3EE"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Ticket Médio AV"
            value={formatCurrency(kpis?.ticket_medio_av)}
            subtitle="Por transação de item a vencer"
            icon={MonetizationOnIcon}
            color="#8B5CF6"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Venda Abaixo do Custo"
            value={formatPercent(kpis?.perc_abaixo_custo)}
            badge={`${formatNumber(kpis?.qtd_abaixo_custo)} un`}
            subtitle={`Deságio: ${formatCurrency(kpis?.valor_abaixo_custo)}`}
            icon={WarningAmberIcon}
            color="#F43F5E"
            loading={loadingKpis}
          />
        </Grid>
      </Grid>

      {/* Gráficos: Evolução Mensal e Top Vendedores */}
      <Grid container spacing={2}>
        {/* Evolução Mensal com Linha de Meta 80% */}
        <Grid item xs={12} lg={7}>
          <ChartCard
            title="Evolução Temporal: Faturamento AV e Taxa de Conversão"
            subtitle="Volume financeiro liquidado mensalmente vs meta corporativa de 80%"
            loading={loadingEvolucao}
            height={380}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={evolucao || []}
                margin={{ top: 10, right: 30, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="ano_mes"
                  stroke="#94A3B8"
                  fontSize={11}
                  interval={Math.ceil((evolucao?.length || 1) / 12)}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickFormatter={(v) => formatShortCurrency(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10B981"
                  fontSize={11}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(val, name) => [
                    name === 'Taxa de Conversão' ? `${val}%` : formatCurrency(val),
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderColor: '#334155',
                    borderRadius: 8,
                    color: '#F8FAFC',
                  }}
                />
                <Legend verticalAlign="top" />
                <ReferenceLine yAxisId="right" y={80} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Meta: 80%', fill: '#10B981', fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="faturamento_av" name="Faturamento AV (R$)" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="perc_conversao" name="Taxa de Conversão" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Top Vendedores de Produtos AV */}
        <Grid item xs={12} lg={5}>
          <ChartCard
            title="Top 10 Vendedores: Destaques em Conversão AV"
            subtitle="Profissionais com maior faturamento em liquidação preventiva de produtos"
            loading={loadingVendedores}
            height={380}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...(topVendedores || [])].reverse()}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickFormatter={(v) => formatShortCurrency(v)}
                />
                <YAxis
                  type="category"
                  dataKey="nome_vendedor"
                  stroke="#94A3B8"
                  fontSize={11}
                  width={110}
                  tickFormatter={(val) => (val?.length > 14 ? `${val.substring(0, 12)}...` : val)}
                />
                <Tooltip
                  formatter={(val) => [formatCurrency(val), 'Faturamento AV']}
                  labelFormatter={(_, arr) => {
                    const item = arr[0]?.payload;
                    return item ? `${item.nome_vendedor} - ${item.nome_filial} (#${item.filial})` : '';
                  }}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderColor: '#334155',
                    borderRadius: 8,
                    color: '#F8FAFC',
                  }}
                />
                <Bar dataKey="valor_total" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Gráfico de Categorias */}
      <ChartCard
        title="Desempenho de Vendas AV por Categoria Farmacêutica"
        subtitle="Volume faturado e eficácia da liquidação por departamento"
        loading={loadingCategorias}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={porCategoria || []}
            margin={{ top: 10, right: 20, left: 10, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="categoria" stroke="#94A3B8" fontSize={11} />
            <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => formatShortCurrency(v)} />
            <Tooltip
              formatter={(val) => [formatCurrency(val), 'Faturamento AV']}
              contentStyle={{
                backgroundColor: '#1E293B',
                borderColor: '#334155',
                borderRadius: 8,
                color: '#F8FAFC',
              }}
            />
            <Bar dataKey="faturamento_av" fill="#22D3EE" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tabela de Transações */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Registro Operacional de Vendas de Produtos A Vencer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Consulte qualquer transação por SKU, filial ou vendedor para avaliar margens e deságio.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <ToggleButtonGroup
                size="small"
                value={filtroCusto}
                exclusive
                onChange={(_, val) => val && setFiltroCusto(val)}
                sx={{ height: 40 }}
              >
                <ToggleButton value="todos">Todas</ToggleButton>
                <ToggleButton value="abaixo">Abaixo do Custo</ToggleButton>
                <ToggleButton value="normal">Margem Normal</ToggleButton>
              </ToggleButtonGroup>

              <TextField
                id="input-busca-av"
                size="small"
                placeholder="Buscar SKU, vendedor, loja..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 260 }}
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
            autoHeight
          />
        </CardContent>
      </Card>
    </Box>
  );
}
