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

  const supervisores = meta?.supervisores || [];
  const cidadesPorSupervisor = meta?.cidades_por_supervisor || {};
  const todasCidades = meta?.cidades || [];
  const filiais = meta?.filiais || [];
  const compradores = meta?.compradores || [];
  const categorias = meta?.categorias || [];
  const dataReferencia = meta?.data_referencia || '2026-09-30';

  // Lista de cidades disponíveis baseada no supervisor selecionado
  let cidadesDisponiveis = [];
  if (filters.supervisor && cidadesPorSupervisor[filters.supervisor]) {
    cidadesDisponiveis = cidadesPorSupervisor[filters.supervisor];
  } else {
    cidadesDisponiveis = todasCidades;
  }

  // Lista de filiais filtradas por supervisor e cidade
  const filiaisFiltradas = filiais.filter((f) => {
    if (filters.supervisor && f.supervisor?.toUpperCase() !== filters.supervisor?.toUpperCase()) return false;
    if (filters.cidade && f.cidade?.toUpperCase() !== filters.cidade?.toUpperCase()) return false;
    return true;
  });

  const hasActiveFilters = Boolean(
    filters.supervisor ||
    filters.cidade ||
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
      {/* 1. Supervisor */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="filtro-supervisor-label">Supervisor</InputLabel>
        <Select
          labelId="filtro-supervisor-label"
          id="filtro-supervisor"
          value={filters.supervisor || ''}
          label="Supervisor"
          onChange={(e) => dispatch(setFilter({ key: 'supervisor', value: e.target.value }))}
        >
          <MenuItem value="">
            <em>Todos ({supervisores.length})</em>
          </MenuItem>
          {supervisores.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 2. Cidade */}
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel id="filtro-cidade-label">Cidade</InputLabel>
        <Select
          labelId="filtro-cidade-label"
          id="filtro-cidade"
          value={filters.cidade || ''}
          label="Cidade"
          onChange={(e) => dispatch(setFilter({ key: 'cidade', value: e.target.value }))}
        >
          <MenuItem value="">
            <em>Todas ({cidadesDisponiveis.length})</em>
          </MenuItem>
          {cidadesDisponiveis.map((cid) => (
            <MenuItem key={cid} value={cid}>
              {cid}
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
        sx={{
          width: 140,
          '& input::-webkit-calendar-picker-indicator': {
            filter: (theme) => (theme.palette.mode === 'dark' ? 'invert(1)' : 'none'),
            cursor: 'pointer',
          },
        }}
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
        sx={{
          width: 140,
          '& input::-webkit-calendar-picker-indicator': {
            filter: (theme) => (theme.palette.mode === 'dark' ? 'invert(1)' : 'none'),
            cursor: 'pointer',
          },
        }}
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
