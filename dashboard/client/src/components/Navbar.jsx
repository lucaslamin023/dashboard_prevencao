import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import ShieldIcon from '@mui/icons-material/Shield';
import { useDispatch, useSelector } from 'react-redux';
import { toggleMode } from '../state/filtersSlice.js';

export default function Navbar({ onToggleSidebar }) {
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.filters.mode);

  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? '#0F172A' : '#FFFFFF',
        color: 'text.primary',
        boxShadow: 'none',
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: '60px !important', px: 2 }}>
        {/* Esquerda: Menu Hamburguer e Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            id="btn-toggle-menu"
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={onToggleSidebar}
            sx={{ mr: 0.5 }}
          >
            <MenuIcon />
          </IconButton>

          <Box
            sx={{
              p: 0.8,
              borderRadius: '10px',
              backgroundColor: 'rgba(34, 211, 238, 0.15)',
              color: '#22D3EE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldIcon />
          </Box>

          <Box>
            <Typography variant="h5" fontWeight={800} letterSpacing={-0.3} sx={{ lineHeight: 1.1 }}>
              PREVENÇÃO DE PERDAS
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Plataforma Analítica & Monitoramento Farmacêutico
            </Typography>
          </Box>
        </Box>

        {/* Direita: Alternador Dark/Light */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={`Mudar para modo ${mode === 'dark' ? 'claro' : 'escuro'}`}>
            <IconButton
              id="btn-toggle-theme"
              onClick={() => dispatch(toggleMode())}
              color="inherit"
              sx={{
                p: 1,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {mode === 'dark' ? (
                <LightModeOutlinedIcon sx={{ color: '#F59E0B' }} />
              ) : (
                <DarkModeOutlinedIcon sx={{ color: '#64748B' }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
