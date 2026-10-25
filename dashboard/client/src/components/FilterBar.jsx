import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  TextField,
} from '@mui/material';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useDispatch, useSelector } from 'react-redux';
import { setFilter, resetFilters } from '../state/filtersSlice.js';
import { useGetMetaFiltrosQuery } from '../state/api.js';

export default function FilterBar() {
  const dispatch = useDispatch();
  const filters = useSelector((state) => state.filters);
  const { data: meta } = useGetMetaFiltrosQuery();

  const regioes = meta?.regioes || [];
  const estadosPorRegiao = meta?.estados_por_regiao || {};
  const filiais = meta?.filiais || [];
  const compradores = meta?.compradores || [];
  const categorias = meta?.categorias || [];
  const dataReferencia = meta?.data_referencia || '2026-09-30';

  // Lista de estados disponíveis baseada na região selecionada
  let estadosDisponiveis = [];
  if (filters.regiao && estadosPorRegiao[filters.regiao]) {
    estadosDisponiveis = estadosPorRegiao[filters.regiao];
  } else {
    // Todos os estados
    const allEst = new Set();
    Object.values(estadosPorRegiao).forEach((arr) => arr.forEach((e) => allEst.add(e)));
    estadosDisponiveis = Array.from(allEst).sort();
  }

  // Lista de filiais filtradas por região e estado
  const filiaisFiltradas = filiais.filter((f) => {
    if (filters.regiao && f.regiao?.toUpperCase() !== filters.regiao?.toUpperCase()) return false;
    if (filters.estado && f.estado?.toUpperCase() !== filters.estado?.toUpperCase()) return false;
    return true;
  });

  const hasActiveFilters = Boolean(
    filters.regiao ||
    filters.estado ||
    filters.filial ||
    filters.comprador ||
    filters.categoria ||
    filters.dataIni ||
    filters.dataFim
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        px: 2,
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* 1. Região */}
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel id="filtro-regiao-label">Região</InputLabel>
        <Select
          labelId="filtro-regiao-label"
          id="filtro-regiao"
          value={filters.regiao || ''}
          label="Região"
          onChange={(e) => dispatch(setFilter({ key: 'regiao', value: e.target.value }))}
        >
          <MenuItem value="">
            <em>Todas</em>
          </MenuItem>
          {regioes.map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 2. Estado */}
      <FormControl size="small" sx={{ minWidth: 110 }}>
        <InputLabel id="filtro-estado-label">Estado</InputLabel>
        <Select
          labelId="filtro-estado-label"
          id="filtro-estado"
          value={filters.estado || ''}
          label="Estado"
          onChange={(e) => dispatch(setFilter({ key: 'estado', value: e.target.value }))}
        >
          <MenuItem value="">
            <em>Todos</em>
          </MenuItem>
          {estadosDisponiveis.map((est) => (
            <MenuItem key={est} value={est}>
              {est}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 3. Filial */}
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="filtro-filial-label">Filial</InputLabel>
        <Select
          labelId="filtro-filial-label"
          id="filtro-filial"
          value={filters.filial || ''}
          label="Filial"
          onChange={(e) => dispatch(setFilter({ key: 'filial', value: e.target.value }))}
        >
          <MenuItem value="">
            <em>Todas ({filiaisFiltradas.length})</em>
          </MenuItem>
          {filiaisFiltradas.map((f) => (
            <MenuItem key={f.filial} value={f.filial}>
              {`#${f.filial} - ${f.nome || 'Filial'}`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 4. Comprador */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel id="filtro-comprador-label">Comprador</InputLabel>
        <Select
          labelId="filtro-comprador-label"
          id="filtro-comprador"
          value={filters.comprador || ''}
          label="Comprador"
          onChange={(e) => dispatch(setFilter({ key: 'comprador', value: e.target.value }))}
        >
          <MenuItem value="">
            <em>Todos</em>
          </MenuItem>
          {compradores.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 5. Categoria */}
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="filtro-categoria-label">Categoria</InputLabel>
        <Select
          labelId="filtro-categoria-label"
          id="filtro-categoria"
          value={filters.categoria || ''}
          label="Categoria"
          onChange={(e) => dispatch(setFilter({ key: 'categoria', value: e.target.value }))}
        >
          <MenuItem value="">
            <em>Todas</em>
          </MenuItem>
          {categorias.map((cat) => (
            <MenuItem key={cat} value={cat}>
              {cat}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 6. Período De */}
      <TextField
        id="filtro-data-ini"
        size="small"
        label="Mês De"
        type="month"
        value={filters.dataIni || ''}
        onChange={(e) => dispatch(setFilter({ key: 'dataIni', value: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: '2023-01', max: '2026-09' }}
        sx={{ width: 140 }}
      />

      {/* 7. Período Até */}
      <TextField
        id="filtro-data-fim"
        size="small"
        label="Mês Até"
        type="month"
        value={filters.dataFim || ''}
        onChange={(e) => dispatch(setFilter({ key: 'dataFim', value: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: '2023-01', max: '2026-09' }}
        sx={{ width: 140 }}
      />

      {/* Botão Limpar Filtros */}
      {hasActiveFilters && (
        <Tooltip title="Limpar todos os filtros">
          <IconButton
            id="btn-limpar-filtros"
            size="small"
            color="primary"
            onClick={() => dispatch(resetFilters())}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <FilterAltOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
