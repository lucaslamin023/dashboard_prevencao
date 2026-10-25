import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useSelector } from 'react-redux';

export default function ExportButton({
  endpoint,
  filename = 'exportacao.csv',
  label = 'Exportar CSV',
  id = 'btn-exportar-csv',
  extraParams = {},
}) {
  const [loading, setLoading] = useState(false);
  const filters = useSelector((state) => state.filters);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
        : '/api';

      const query = new URLSearchParams();
      const allParams = { ...filters, ...extraParams };
      delete allParams.mode;

      Object.keys(allParams).forEach((key) => {
        const val = allParams[key];
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, val);
        }
      });

      const url = `${baseUrl}${endpoint}?${query.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha no download');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      alert('Erro ao realizar download do CSV.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      id={id}
      variant="outlined"
      size="small"
      startIcon={loading ? <CircularProgress size={16} /> : <DownloadIcon />}
      disabled={loading}
      onClick={handleDownload}
      sx={{
        fontWeight: 600,
        borderColor: (theme) => (theme.palette.mode === 'dark' ? '#334155' : '#CBD5E1'),
      }}
    >
      {label}
    </Button>
  );
}
