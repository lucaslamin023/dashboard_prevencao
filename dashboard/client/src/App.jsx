import React, { useMemo, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { useSelector } from 'react-redux';

import { createAppTheme } from './theme.js';
import Layout from './components/Layout.jsx';

// Code-splitting via React.lazy
const Overview = lazy(() => import('./scenes/overview/index.jsx'));
const VendasAv = lazy(() => import('./scenes/vendasAv/index.jsx'));
const Inventario = lazy(() => import('./scenes/inventario/index.jsx'));
const RiscoMl = lazy(() => import('./scenes/riscoMl/index.jsx'));
const Excesso = lazy(() => import('./scenes/excesso/index.jsx'));
const Ruptura = lazy(() => import('./scenes/ruptura/index.jsx'));
const ScoreAuditoria = lazy(() => import('./scenes/score/index.jsx'));
const Metodologia = lazy(() => import('./scenes/metodologia/index.jsx'));

function LoadingFallback() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <CircularProgress size={36} color="primary" />
    </Box>
  );
}

export default function App() {
  const mode = useSelector((state) => state.filters.mode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/vendas-av" element={<VendasAv />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/risco-ml" element={<RiscoMl />} />
              <Route path="/excesso" element={<Excesso />} />
              <Route path="/ruptura" element={<Ruptura />} />
              <Route path="/score" element={<ScoreAuditoria />} />
              <Route path="/metodologia" element={<Metodologia />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
