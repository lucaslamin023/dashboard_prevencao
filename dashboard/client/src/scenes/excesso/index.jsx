import React, { useState } from 'react';
import { Box, Grid, Typography, Card, CardContent } from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import StorefrontIcon from '@mui/icons-material/Storefront';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { useSelector } from 'react-redux';
import { ResponsiveTreeMap } from '@nivo/treemap';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

import KpiCard from '../../components/KpiCard.jsx';
import ChartCard from '../../components/ChartCard.jsx';
import ServerDataGrid from '../../components/ServerDataGrid.jsx';
import {
  useGetExcessoKpisQuery,
  useGetExcessoTreemapQuery,
  useGetExcessoPorCategoriaQuery,
  useGetExcessoFiliaisQuery,
} from '../../state/api.js';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShortCurrency,
} from '../../utils/format.js';

export default function Excesso() {
  const filters = useSelector((state) => state.filters);

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'valor_excesso_custo', sort: 'desc' }]);

  const queryParams = { ...filters };
  delete queryParams.mode;

  const filiaisParams = {
    ...queryParams,
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    sort: sortModel[0]?.field || 'valor_excesso_custo',
    order: sortModel[0]?.sort || 'desc',
  };

  const { data: kpis, isLoading: loadingKpis } = useGetExcessoKpisQuery(queryParams);
  const { data: treemapData, isLoading: loadingTreemap } = useGetExcessoTreemapQuery(queryParams);
  const { data: catData, isLoading: loadingCat } = useGetExcessoPorCategoriaQuery(queryParams);
  const { data: filiaisData, isLoading: loadingFiliais } = useGetExcessoFiliaisQuery(filiaisParams);

  const topLojas = treemapData?.top_filiais || (() => {
    if (!treemapData?.children) return [];
    const all = [];
    treemapData.children.forEach((c) => {
      if (Array.isArray(c.children)) {
        c.children.forEach((f) => {
          all.push({
            filial: f.filial,
            nome: f.name,
            nome_curto: f.name.length > 20 ? `${f.name.substring(0, 18)}...` : f.name,
            estado: c.name,
            valor_excesso: f.valor_excesso || 0,
            estoque_un: f.estoque_un || 0,
            excesso_un: f.excesso_un || 0,
            perc_excesso: f.perc_excesso || 0,
          });
        });
      }
    });
    return all.sort((a, b) => b.valor_excesso - a.valor_excesso).slice(0, 10);
  })();

  const columns = [
    { field: 'filial', headerName: 'Filial', width: 90 },
    { field: 'nome_filial', headerName: 'Unidade', flex: 1.2, minWidth: 170 },
    { field: 'supervisor', headerName: 'Supervisor', flex: 1, minWidth: 150 },
    { field: 'regiao', headerName: 'Região', width: 130 },
    { field: 'estado', headerName: 'UF', width: 70 },
    {
      field: 'estoque_un',
      headerName: 'Estoque Total (UN)',
      width: 140,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatNumber(val) : '—';
      },
    },
    {
      field: 'excesso_un',
      headerName: 'Excesso (UN)',
      width: 130,
      renderCell: (params) => (
        <span style={{ color: '#F59E0B', fontWeight: 700 }}>
          {formatNumber(params.value)}
        </span>
      ),
    },
    {
      field: 'valor_excesso_custo',
      headerName: 'Capital Imobilizado',
      width: 160,
      renderCell: (params) => (
        <span style={{ color: '#F43F5E', fontWeight: 700 }}>
          {formatCurrency(params.value)}
        </span>
      ),
    },
    {
      field: 'perc_excesso',
      headerName: '% Excesso',
      width: 110,
      renderCell: (params) => {
        const val = params.value || 0;
        const color = val > 15 ? '#EF4444' : val > 8 ? '#F59E0B' : '#10B981';
        return <span style={{ color, fontWeight: 700 }}>{formatPercent(val)}</span>;
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box>
        <Typography variant="h2" fontWeight={800} gutterBottom>
          Excesso de Estoque & Capital Imobilizado
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Identificação de filiais e categorias com estoque acima da demanda projetada (&gt; 45 dias de cobertura) e risco de desvalorização.
        </Typography>
      </Box>

      {/* Grid de 4 KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Estoque Total"
            value={formatNumber(kpis?.estoque_total_un)}
            subtitle="Volume total na rede"
            icon={Inventory2Icon}
            color="#22D3EE"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Volume em Excesso"
            value={formatNumber(kpis?.excesso_total_un)}
            subtitle="Unidades > 45 dias de cobertura"
            icon={WarningAmberIcon}
            color="#F59E0B"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Capital Imobilizado"
            value={formatCurrency(kpis?.valor_excesso_custo)}
            subtitle="Custo do excesso em estoque"
            icon={MonetizationOnIcon}
            color="#F43F5E"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Filiais em Excesso Crítico"
            value={formatNumber(kpis?.qtd_filiais_criticas)}
            badge={formatPercent(kpis?.perc_indice_excesso)}
            subtitle="Índice de excesso > 15%"
            icon={StorefrontIcon}
            color="#E11D48"
            loading={loadingKpis}
          />
        </Grid>
      </Grid>

      {/* Gráficos: Top 10 Lojas com Capital Imobilizado e Barras Empilhadas por Categoria */}
      <Grid container spacing={2}>
        {/* Top 10 Lojas com Capital Imobilizado */}
        <Grid item xs={12} lg={6}>
          <ChartCard
            title="Top 10 Filiais: Maior Capital Imobilizado em Excesso"
            subtitle="Ranking das lojas com maior valor financeiro parado em estoque excedente"
            loading={loadingTreemap}
            height={380}
          >
            {topLojas && topLojas.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...topLojas].reverse()}
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
                    dataKey="nome_curto"
                    stroke="#94A3B8"
                    fontSize={11}
                    width={130}
                    tickFormatter={(val) => val}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), 'Capital Imobilizado']}
                    labelFormatter={(_, arr) => {
                      const item = arr[0]?.payload;
                      return item ? `${item.nome} (#${item.filial}) - UF: ${item.estado}` : '';
                    }}
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderColor: '#334155',
                      borderRadius: 8,
                      color: '#F8FAFC',
                    }}
                  />
                  <Bar dataKey="valor_excesso" fill="#F43F5E" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">Sem dados para exibição</Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Barras Empilhadas por Categoria */}
        <Grid item xs={12} lg={6}>
          <ChartCard
            title="Composição de Excesso por Categoria"
            subtitle="Distribuição em unidades: Estoque Normal vs Excesso Elevado vs Excesso Crítico"
            loading={loadingCat}
            height={380}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={catData || []}
                margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="categoria"
                  stroke="#94A3B8"
                  fontSize={10}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickFormatter={(v) => formatShortCurrency(v).replace('R$', '')}
                />
                <Tooltip
                  formatter={(val, name) => [
                    formatNumber(val) + ' un',
                    name === 'normal'
                      ? 'Normal'
                      : name === 'elevado'
                      ? 'Excesso Elevado (45-90d)'
                      : 'Excesso Crítico (>90d)',
                  ]}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderColor: '#334155',
                    borderRadius: 8,
                    color: '#F8FAFC',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  formatter={(val) =>
                    val === 'normal'
                      ? 'Normal'
                      : val === 'elevado'
                      ? 'Elevado (45-90d)'
                      : 'Crítico (>90d)'
                  }
                />
                <Bar dataKey="normal" stackId="a" fill="#10B981" />
                <Bar dataKey="elevado" stackId="a" fill="#F59E0B" />
                <Bar dataKey="critico" stackId="a" fill="#F43F5E" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Tabela de Ação por Filial */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Matriz de Ação e Capital Imobilizado por Loja
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Priorização de supervisores e lojas com maior volume financeiro represado para campanhas de giro ou transferência.
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
