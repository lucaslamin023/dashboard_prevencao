import { createTheme } from '@mui/material/styles';

export const tokens = {
  // Cores semânticas de negócio
  success: '#10B981', // Normal / Vendas
  warning: '#F59E0B', // Atenção / Excesso
  danger: '#F43F5E',  // Perda / Crítico / Ruptura
  ml: '#8B5CF6',      // Risco ML
  audit: '#22D3EE',   // Score de Auditoria (Ciano)

  // Escala de Risco
  risk: {
    baixo: '#10B981',
    medio: '#EAB308',
    medioAlto: '#F97316',
    alto: '#EF4444',
    critico: '#E11D48',
  },
};

export const themeSettings = (mode = 'dark') => {
  const isDark = mode === 'dark';

  return {
    palette: {
      mode,
      ...(isDark
        ? {
            // Dark Mode
            primary: {
              main: '#22D3EE', // Ciano moderno
              light: '#67E8F9',
              dark: '#0891B2',
              contrastText: '#0F172A',
            },
            secondary: {
              main: '#8B5CF6', // Roxo ML
              light: '#A78BFA',
              dark: '#6D28D9',
            },
            background: {
              default: '#0F172A', // Slate 900
              paper: '#1E293B',   // Slate 800
              card: '#1E293B',
              hover: 'rgba(51, 65, 85, 0.4)',
              border: '#334155',
            },
            text: {
              primary: '#F8FAFC',
              secondary: '#94A3B8',
              disabled: '#64748B',
            },
            divider: '#334155',
          }
        : {
            // Light Mode
            primary: {
              main: '#0284C7',
              light: '#38BDF8',
              dark: '#0369A1',
              contrastText: '#FFFFFF',
            },
            secondary: {
              main: '#7C3AED',
              light: '#8B5CF6',
              dark: '#6D28D9',
            },
            background: {
              default: '#F1F5F9', // Slate 100
              paper: '#FFFFFF',
              card: '#FFFFFF',
              hover: 'rgba(241, 245, 249, 0.8)',
              border: '#E2E8F0',
            },
            text: {
              primary: '#0F172A',
              secondary: '#64748B',
              disabled: '#94A3B8',
            },
            divider: '#E2E8F0',
          }),
    },
    typography: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: 13,
      h1: { fontFamily: 'Inter', fontSize: 32, fontWeight: 700 },
      h2: { fontFamily: 'Inter', fontSize: 24, fontWeight: 700 },
      h3: { fontFamily: 'Inter', fontSize: 20, fontWeight: 600 },
      h4: { fontFamily: 'Inter', fontSize: 16, fontWeight: 600 },
      h5: { fontFamily: 'Inter', fontSize: 14, fontWeight: 600 },
      h6: { fontFamily: 'Inter', fontSize: 12, fontWeight: 600 },
      body1: { fontSize: 13 },
      body2: { fontSize: 12 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? '#475569 #0F172A' : '#CBD5E1 #F1F5F9',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            backgroundImage: 'none',
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            boxShadow: isDark
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.2)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            '&:hover': {
              borderColor: isDark ? '#475569' : '#CBD5E1',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 600,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 6,
          },
        },
      },
    },
  };
};

export const createAppTheme = (mode = 'dark') => createTheme(themeSettings(mode));

export default createAppTheme;
