import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ProductionQuantityLimitsOutlinedIcon from '@mui/icons-material/ProductionQuantityLimitsOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import RuleFolderOutlinedIcon from '@mui/icons-material/RuleFolderOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  {
    text: 'Executive Overview',
    path: '/',
    icon: DashboardOutlinedIcon,
    color: '#10B981',
  },
  {
    text: 'Vendas A Vencer',
    path: '/vendas-av',
    icon: TrendingUpOutlinedIcon,
    color: '#059669',
  },
  {
    text: 'Acuracidade & Inventário',
    path: '/inventario',
    icon: RuleFolderOutlinedIcon,
    color: '#06B6D4',
  },
  {
    text: 'Excesso por Filial',
    path: '/excesso',
    icon: Inventory2OutlinedIcon,
    color: '#F59E0B',
  },
  {
    text: 'Monitor de Ruptura',
    path: '/ruptura',
    icon: ProductionQuantityLimitsOutlinedIcon,
    color: '#F43F5E',
  },
  {
    text: 'Score de Auditoria',
    path: '/score',
    icon: FactCheckOutlinedIcon,
    color: '#EC4899',
  },
  {
    text: 'Metodologia',
    path: '/metodologia',
    icon: MenuBookOutlinedIcon,
    color: '#94A3B8',
  },
];

export default function Sidebar({ open, onClose, isMobile }) {
  const location = useLocation();
  const navigate = useNavigate();

  const drawerContent = (
    <Box sx={{ width: 260, height: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box sx={{ p: 2.5 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={1}>
          Módulos Analíticos
        </Typography>
      </Box>

      <List sx={{ px: 1.5, py: 0 }}>
        {navItems.map((item) => {
          const isSelected =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          const IconComponent = item.icon;

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.8 }}>
              <ListItemButton
                id={`nav-item-${item.path.replace('/', '') || 'overview'}`}
                selected={isSelected}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) onClose();
                }}
                sx={{
                  borderRadius: '10px',
                  py: 1.2,
                  px: 1.5,
                  transition: 'all 0.15s ease',
                  '&.Mui-selected': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(34, 211, 238, 0.12)' : 'rgba(2, 132, 199, 0.12)',
                    borderLeft: `4px solid ${item.color}`,
                    color: 'text.primary',
                    fontWeight: 700,
                    '& .MuiListItemIcon-root': {
                      color: item.color,
                    },
                  },
                  '&:hover': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 0.8)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: isSelected ? item.color : 'text.secondary' }}>
                  <IconComponent />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.88rem',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      open={open}
      onClose={onClose}
      sx={{
        width: open ? 260 : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 260,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? '#0F172A' : '#FFFFFF',
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          top: isMobile ? 0 : '60px',
          height: isMobile ? '100%' : 'calc(100% - 60px)',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
