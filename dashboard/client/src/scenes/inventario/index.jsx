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
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import SearchIcon from '@mui/icons-material/Search';
import ReplayIcon from '@mui/icons-material/Replay';
import { useSelector } from 'react-redux';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
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
  useGetInventarioKpisQuery,
  useGetInventarioEvolucaoQuery,
  useGetInventarioUltimoQuery,
  useGetInventarioDivergenciasCatQuery,
  useGetInventarioTopProdutosQuery,
} from '../../state/api.js';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShortCurrency,
  formatDate,
} from '../../utils/format.js';

export default function Inventario() {
  const filters = useSelector((state) => state.filters);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'acuracidade_perc', sort: 'asc' }]);

  const queryParams = { ...filters };
  delete queryParams.mode;

  const tabelaParams = {
    ...queryParams,
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    sort: sortModel[0]?.field || 'acuracidade_perc',
    order: sortModel[0]?.sort || 'asc',
    q: busca || undefined,
    status_acuracidade: statusFiltro || undefined,
  };

  const { data: kpis, isLoading: loadingKpis } = useGetInventarioKpisQuery(queryParams);
  const { data: evolucao, isLoading: loadingEvolucao } = useGetInventarioEvolucaoQuery(queryParams);
  const { data: divergenciasCat, isLoading: loadingCat } = useGetInventarioDivergenciasCatQuery(queryParams);
  const { data: topProdutos, isLoading: loadingTop } = useGetInventarioTopProdutosQuery(queryParams);
  const { data: tabelaData, isLoading: loadingTabela } = useGetInventarioUltimoQuery(tabelaParams);

  const columns = [
    { field: 'filial', headerName: 'Filial', width: 80 },
    { field: 'nome_filial', headerName: 'Unidade', flex: 1.2, minWidth: 160 },
    { field: 'estado', headerName: 'UF', width: 65 },
    { field: 'supervisor', headerName: 'Supervisor', width: 140 },
    {
      field: 'data',
      headerName: 'Data Inventário',
      width: 125,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return formatDate(val);
      },
    },
    {
      field: 'estoque_anterior',
      headerName: 'Estoque Ant. (R$)',
      width: 140,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatCurrency(val) : '—';
      },
    },
    {
      field: 'valor_sobra',
      headerName: 'Sobra (R$)',
      width: 115,
      renderCell: (params) => (
        <span style={{ color: '#22D3EE', fontWeight: 600 }}>
          {formatCurrency(params.value)}
        </span>
      ),
    },
    {
      field: 'valor_falta',
      headerName: 'Falta (R$)',
      width: 115,
      renderCell: (params) => (
        <span style={{ color: '#F43F5E', fontWeight: 600 }}>
          {formatCurrency(params.value)}
        </span>
      ),
    },
    {
      field: 'diferenca_liquida',
      headerName: 'Dif. Líquida',
      width: 125,
      renderCell: (params) => {
        const val = params.value || 0;
        const color = val >= 0 ? '#10B981' : '#F43F5E';
        return <span style={{ color, fontWeight: 700 }}>{formatCurrency(val)}</span>;
      },
    },
    {
      field: 'acuracidade_perc',
      headerName: '% Acuracidade',
      width: 130,
      renderCell: (params) => {
        const val = params.value ?? 0;
        const color = val >= 99.5 ? '#10B981' : val >= 99.0 ? '#F59E0B' : '#E11D48';
        return (
          <span style={{ color, fontWeight: 800, fontSize: '0.95rem' }}>
            {val.toFixed(2)}%
          </span>
        );
      },
    },
    {
      field: 'status_acuracidade',
      headerName: 'Status',
      width: 150,
      renderCell: (params) => {
        const status = params.value;
        const color =
          status === 'Dentro da Meta' ? 'success' : status === 'Atenção' ? 'warning' : 'error';
        return (
          <Chip
            label={status}
            size="small"
            color={color}
            sx={{ fontWeight: 700, fontSize: '0.75rem' }}
          />
        );
      },
    },
    { field: 'metodo', headerName: 'Método', width: 130 },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2" fontWeight={800} gutterBottom>
            Acuracidade de Estoque & Auditoria de Inventários
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitoramento das variações físicas vs sistêmicas, divergências por categoria e status de conformidade do estoque (&ge; 99,50%).
          </Typography>
        </Box>
      </Box>

      {/* Grid de 5 KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Acuracidade Média"
            value={kpis ? `${kpis.acuracidade_media.toFixed(2)}%` : '—'}
            badge="Meta: 99,50%"
            subtitle="Conformidade da rede"
            icon={FactCheckIcon}
            color={(kpis?.acuracidade_media || 0) >= 99.5 ? '#10B981' : '#F59E0B'}
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Dentro da Meta"
            value={formatNumber(kpis?.lojas_dentro_meta)}
            badge="&ge; 99,50%"
            subtitle={`${formatPercent(kpis?.perc_dentro_meta)} dos inventários`}
            icon={CheckCircleOutlineIcon}
            color="#10B981"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Taxa de Reincidência"
            value={formatPercent(kpis?.taxa_reincidencia)}
            badge="< 99,50% 2x seguidas"
            subtitle={`${formatNumber(kpis?.filiais_reincidentes)} filiais reincidentes`}
            icon={ReplayIcon}
            color={(kpis?.taxa_reincidencia || 0) > 30 ? '#EF4444' : '#F59E0B'}
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Estado Urgente"
            value={`${formatNumber(kpis?.filiais_urgentes_ultimo)} filiais`}
            badge="< 99,00% (Último)"
            subtitle={`${formatPercent(kpis?.perc_urgente_ultimo)} do último inventário`}
            icon={ErrorOutlineIcon}
            color="#E11D48"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <KpiCard
            title="Divergência Líquida"
            value={formatCurrency(kpis?.diferenca_liquida)}
            subtitle={`Sobras: ${formatShortCurrency(kpis?.valor_sobra)} | Faltas: ${formatShortCurrency(kpis?.valor_falta)}`}
            icon={CompareArrowsIcon}
            color={kpis?.diferenca_liquida >= 0 ? '#10B981' : '#F43F5E'}
            loading={loadingKpis}
          />
        </Grid>
      </Grid>

      {/* Gráficos: Evolução Temporal da Acuracidade e Divergências por Categoria */}
      <Grid container spacing={2}>
        {/* Evolução da Acuracidade com Linhas de Meta */}
        <Grid item xs={12} lg={7}>
          <ChartCard
            title="Evolução da Acuracidade de Estoque (%)"
            subtitle="Comportamento da acuracidade média mensal com limiares de Meta (99,5%) e Urgência (99,0%)"
            loading={loadingEvolucao}
            height={380}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={evolucao || []}
                margin={{ top: 15, right: 30, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="ano_mes"
                  stroke="#94A3B8"
                  fontSize={11}
                  interval={Math.ceil((evolucao?.length || 1) / 12)}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  domain={[98.5, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Acuracidade Média']}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderColor: '#334155',
                    borderRadius: 8,
                    color: '#F8FAFC',
                  }}
                />
                <Legend verticalAlign="top" />
                <ReferenceLine y={99.5} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Meta: 99,50%', fill: '#10B981', fontSize: 11 }} />
                <ReferenceLine y={99.0} stroke="#E11D48" strokeDasharray="3 3" label={{ value: 'Urgente: < 99,00%', fill: '#E11D48', fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="acuracidade"
                  name="Acuracidade de Estoque"
                  stroke="#22D3EE"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Divergências por Categoria */}
        <Grid item xs={12} lg={5}>
          <ChartCard
            title="Divergências por Categoria Farmacêutica"
            subtitle="Volume financeiro divergente por departamento: Falta vs Sobra"
            loading={loadingCat}
            height={380}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={divergenciasCat || []}
                margin={{ top: 10, right: 20, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="categoria" stroke="#94A3B8" fontSize={10} interval={0} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => formatShortCurrency(v)} />
                <Tooltip
                  formatter={(val, name) => [formatCurrency(val), name]}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderColor: '#334155',
                    borderRadius: 8,
                    color: '#F8FAFC',
                  }}
                />
                <Legend verticalAlign="top" />
                <Bar dataKey="falta_valor" name="Faltas (R$)" fill="#F43F5E" stackId="a" />
                <Bar dataKey="sobra_valor" name="Sobras (R$)" fill="#22D3EE" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Top 10 Produtos Divergentes */}
      <ChartCard
        title="Top Produtos com Maior Divergência Financeira"
        subtitle="Itens com maior valor acumulado de divergência no inventário"
        loading={loadingTop}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={(topProdutos || []).slice(0, 10)}
            margin={{ top: 10, right: 30, left: 10, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              dataKey="nome"
              stroke="#94A3B8"
              fontSize={10}
              interval={0}
              angle={-20}
              textAnchor="end"
              tickFormatter={(v) => (v.length > 18 ? `${v.substring(0, 16)}...` : v)}
            />
            <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => formatShortCurrency(v)} />
            <Tooltip
              formatter={(val) => [formatCurrency(val), 'Valor Divergente']}
              labelFormatter={(_, arr) => {
                const item = arr[0]?.payload;
                return item ? `${item.nome} (#${item.codigo}) - ${item.categoria}` : '';
              }}
              contentStyle={{
                backgroundColor: '#1E293B',
                borderColor: '#334155',
                borderRadius: 8,
                color: '#F8FAFC',
              }}
            />
            <Bar dataKey="valor_divergencia" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tabela de Último Inventário por Filial */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Matriz de Último Inventário por Filial
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avalie o percentual de acuracidade e a conformidade operacional de cada loja da rede.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="filtro-status-acuracidade-label">Status Acuracidade</InputLabel>
                <Select
                  labelId="filtro-status-acuracidade-label"
                  id="filtro-status-acuracidade"
                  value={statusFiltro}
                  label="Status Acuracidade"
                  onChange={(e) => setStatusFiltro(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Todos os status</em>
                  </MenuItem>
                  <MenuItem value="Dentro da Meta">Dentro da Meta (&ge; 99,5%)</MenuItem>
                  <MenuItem value="Atenção">Atenção (99,0% - 99,5%)</MenuItem>
                  <MenuItem value="Urgente">Urgente (&lt; 99,0%)</MenuItem>
                </Select>
              </FormControl>

              <TextField
                id="input-busca-inventario"
                size="small"
                placeholder="Buscar filial, supervisor, UF..."
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
