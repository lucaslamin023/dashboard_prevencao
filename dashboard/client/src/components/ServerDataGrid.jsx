import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { Box } from '@mui/material';

export default function ServerDataGrid({
  rows = [],
  columns = [],
  rowCount = 0,
  loading = false,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange,
  onRowClick,
  getRowId = (row) => row.id || `${row.filial}-${row.codigo}`,
  autoHeight = true,
  height = 540,
}) {
  return (
    <Box
      sx={{
        width: '100%',
        height: autoHeight ? 'auto' : height,
        '& .MuiDataGrid-root': {
          border: 'none',
          fontFamily: 'Inter, sans-serif',
        },
        '& .MuiDataGrid-cell': {
          borderBottom: (theme) => `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#E2E8F0'}`,
          fontSize: '0.85rem',
        },
        '& .MuiDataGrid-columnHeaders': {
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC'),
          borderBottom: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#CBD5E1'}`,
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: 0.5,
        },
        '& .MuiDataGrid-row:hover': {
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(51, 65, 85, 0.4)' : '#F1F5F9'),
          cursor: onRowClick ? 'pointer' : 'default',
        },
        '& .MuiDataGrid-footerContainer': {
          borderTop: (theme) => `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#E2E8F0'}`,
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC'),
        },
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        rowCount={rowCount}
        loading={loading}
        paginationMode="server"
        sortingMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        sortModel={sortModel}
        onSortModelChange={onSortModelChange}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={onRowClick}
        getRowId={getRowId}
        disableRowSelectionOnClick
        localeText={ptBR.components.MuiDataGrid.defaultProps.localeText}
        sx={{ minHeight: 350 }}
      />
    </Box>
  );
}
