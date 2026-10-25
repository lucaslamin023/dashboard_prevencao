import React from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { useGetHealthQuery } from '../state/api.js';

export default function ApiStatusBanner() {
  const { data, isLoading, isError } = useGetHealthQuery(undefined, {
    pollingInterval: 30000,
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 1, backgroundColor: '#0284C7', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
        <CircularProgress size={16} sx={{ color: '#FFFFFF' }} />
        <Typography variant="caption" fontWeight={600}>
          Conectando ao servidor e inicializando serviços analíticos...
        </Typography>
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="warning" variant="filled" sx={{ borderRadius: 0, py: 0.5, justifyContent: 'center' }}>
        Servidor em processo de inicialização (cold start do Render). Os dados carregarão automaticamente em instantes.
      </Alert>
    );
  }

  return null;
}
