import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { useDispatch } from 'react-redux';
import { resetFilters } from '../state/filtersSlice.js';

export default function EmptyState({
  title = 'Nenhum registro encontrado',
  description = 'Tente ajustar ou limpar os filtros aplicados para visualizar os dados.',
  showReset = true,
}) {
  const dispatch = useDispatch();

  return (
    <Box
      sx={{
        py: 6,
        px: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.6)',
        borderRadius: 2,
        border: '1px dashed',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          p: 2,
          borderRadius: '50%',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.8)',
          color: 'text.secondary',
          mb: 2,
        }}
      >
        <FilterAltOffIcon sx={{ fontSize: 36 }} />
      </Box>

      <Typography variant="h4" fontWeight={600} gutterBottom>
        {title}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mb: 3 }}>
        {description}
      </Typography>

      {showReset && (
        <Button
          id="btn-limpar-filtros-vazio"
          variant="outlined"
          color="primary"
          onClick={() => dispatch(resetFilters())}
          startIcon={<FilterAltOffIcon />}
        >
          Limpar Filtros Globais
        </Button>
      )}
    </Box>
  );
}
