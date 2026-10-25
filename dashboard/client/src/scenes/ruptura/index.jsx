import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
} from '@mui/material';
import ProductionQuantityLimitsIcon from '@mui/icons-material/ProductionQuantityLimits';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from 'react-redux';
import { ResponsivePie } from '@nivo/pie';

import KpiCard from '../../components/KpiCard.jsx';
import ChartCard from '../../components/ChartCard.jsx';
import ServerDataGrid from '../../components/ServerDataGrid.jsx';
import RiskChip from '../../components/RiskChip.jsx';
import ExportButton from '../../components/ExportButton.jsx';
import {
  useGetRupturaKpisQuery,
  useGetRupturaDistribuicaoQuery,
  useGetRupturaTabelaQuery,
} from '../../state/api.js';
import { formatNumber, formatPercent } from '../../utils/format.js';

export default function Ruptura() {
  const filters = useSelector((state) => state.filters);

  const [busca, setBusca] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: 'demanda', sort: 'desc' }]);

  const queryParams = { ...filters };
  delete queryParams.mode;

  const tabelaParams = {
    ...queryParams,
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    sort: sortModel[0]?.field || 'demanda',
    order: sortModel[0]?.sort || 'desc',
    q: busca || undefined,
  };

  const { data: kpis, isLoading: loadingKpis } = useGetRupturaKpisQuery(queryParams);
  const { data: distribuicao, isLoading: loadingDist } = useGetRupturaDistribuicaoQuery(queryParams);
  const { data: tabelaData, isLoading: loadingTabela } = useGetRupturaTabelaQuery(tabelaParams);

  const columns = [
    { field: 'codigo', headerName: 'Código', width: 90 },
    { field: 'nome', headerName: 'Descrição do Produto', flex: 1.5, minWidth: 200 },
    { field: 'filial', headerName: 'Filial', width: 80 },
    { field: 'nome_filial', headerName: 'Unidade', width: 140 },
    { field: 'categoria', headerName: 'Categoria', width: 130 },
    { field: 'comprador', headerName: 'Comprador', width: 140 },
    {
      field: 'estoque',
      headerName: 'Estoque Atual',
      width: 120,
      renderCell: (params) => {
        const val = params.value ?? 0;
        return (
          <span style={{ fontWeight: 700, color: val === 0 ? '#E11D48' : '#10B981' }}>
            {formatNumber(val)} un
          </span>
        );
      },
    },
    {
      field: 'demanda',
      headerName: 'Demanda',
      width: 100,
      valueFormatter: (value) => {
        const val = typeof value === 'object' && value !== null ? value.value : value;
        return val !== undefined && val !== null ? formatNumber(val, 1) : '—';
      },
    },
    {
      field: 'dias_cobertura',
      headerName: 'Dias de Cobertura',
      width: 140,
      renderCell: (params) => {
        const val = params.value || 0;
        const color = val === 0 ? '#E11D48' : val < 3 ? '#F43F5E' : '#F59E0B';
        return <span style={{ color, fontWeight: 700 }}>{val} dias</span>;
      },
    },
    {
      field: 'status_ruptura',
      headerName: 'Status',
      width: 160,
      renderCell: (params) => <RiskChip label={params.value} size="small" />,
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2" fontWeight={800} gutterBottom>
            Monitor de Ruptura & Cobertura de Estoque
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Visão crítica de desabastecimento em tempo real: produtos sem estoque com demanda ativa e itens com autonomia inferior a 3 dias.
          </Typography>
        </Box>
      </Box>

      {/* Grid de 4 KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Cobertura Média"
            value={`${kpis?.dias_cobertura_medio || 0} d`}
            subtitle="Autonomia média de estoque"
            icon={AccessTimeIcon}
            color="#22D3EE"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Ruptura Consumada"
            value={formatNumber(kpis?.rupt_consumada)}
            subtitle="Estoque = 0 com Demanda > 0"
            icon={ErrorOutlineIcon}
            color="#E11D48"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Crítico / Alto Risco"
            value={formatNumber(kpis?.rupt_critico)}
            subtitle="Cobertura < 3 dias de venda"
            icon={WarningAmberIcon}
            color="#F43F5E"
            loading={loadingKpis}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Taxa de Ruptura Severa"
            value={formatPercent(kpis?.perc_ruptura_severa)}
            subtitle="Consumada + Crítica / Total"
            icon={ProductionQuantityLimitsIcon}
            color="#EF4444"
            loading={loadingKpis}
          />
        </Grid>
      </Grid>

      {/* Rosca por Status e Resumo */}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <ChartCard
            title="Distribuição do Portfólio por Autonomia"
            subtitle="Percentual de itens classificados conforme risco de desabastecimento"
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
              tooltip={({ datum }) => (
                <Box sx={{ p: 1, backgroundColor: '#1E293B', borderRadius: 1, border: '1px solid #334155' }}>
                  <Typography variant="caption" sx={{ color: datum.color, fontWeight: 700 }}>
                    {datum.label}: {formatNumber(datum.value)} itens ({formatPercent(datum.data.perc)})
                  </Typography>
                </Box>
              )}
            />
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 3 }}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Protocolo de Ressuprimento de Emergência
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Itens listados nesta tela exigem prioridade imediata de compra ou solicitação de transferência entre CDs/lojas para estancar perda de vendas.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.2, borderRadius: 2, backgroundColor: 'rgba(225, 29, 72, 0.1)', border: '1px solid rgba(225, 29, 72, 0.3)' }}>
                <Typography variant="body2" fontWeight={700} color="#E11D48">Ruptura Consumada (0 unidades)</Typography>
                <Typography variant="body2" fontWeight={800}>{formatNumber(kpis?.rupt_consumada)} ocorrências</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.2, borderRadius: 2, backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                <Typography variant="body2" fontWeight={700} color="#F43F5E">Estoque Crítico (&lt; 3 dias)</Typography>
                <Typography variant="body2" fontWeight={800}>{formatNumber(kpis?.rupt_critico)} ocorrências</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.2, borderRadius: 2, backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <Typography variant="body2" fontWeight={700} color="#F59E0B">Risco Moderado (3 a 10 dias)</Typography>
                <Typography variant="body2" fontWeight={800}>{formatNumber(kpis?.rupt_moderado)} ocorrências</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.2, borderRadius: 2, backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <Typography variant="body2" fontWeight={700} color="#10B981">Sem Risco (&gt; 10 dias de autonomia)</Typography>
                <Typography variant="body2" fontWeight={800}>{formatNumber(kpis?.rupt_sem_risco)} ocorrências</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Tabela de Ressuprimento */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Fila Operacional de Ressuprimento (Apenas Crítico e Ruptura)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ordenada por menor prazo de cobertura para despacho logístico prioritário.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                id="input-busca-ruptura"
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

              <ExportButton
                id="btn-export-ruptura"
                endpoint="/ruptura/export"
                filename="ruptura_ressuprimento.csv"
                label="Exportar Fila (CSV)"
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
