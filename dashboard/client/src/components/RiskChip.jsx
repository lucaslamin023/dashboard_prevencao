import React from 'react';
import { Chip } from '@mui/material';

const COLOR_MAP = {
  // Score Auditoria
  'Alto Risco': { bg: 'rgba(239, 68, 68, 0.16)', text: '#EF4444', border: '#EF4444' },
  'Médio-Alto Risco': { bg: 'rgba(249, 115, 22, 0.16)', text: '#F97316', border: '#F97316' },
  'Médio Risco': { bg: 'rgba(234, 179, 8, 0.16)', text: '#EAB308', border: '#EAB308' },
  'Baixo Risco': { bg: 'rgba(16, 185, 129, 0.16)', text: '#10B981', border: '#10B981' },

  // ML
  'Crítico': { bg: 'rgba(225, 29, 72, 0.16)', text: '#E11D48', border: '#E11D48' },
  'Alto': { bg: 'rgba(239, 68, 68, 0.16)', text: '#EF4444', border: '#EF4444' },
  'Médio': { bg: 'rgba(234, 179, 8, 0.16)', text: '#EAB308', border: '#EAB308' },
  'Baixo': { bg: 'rgba(16, 185, 129, 0.16)', text: '#10B981', border: '#10B981' },

  // Ruptura
  'Ruptura Consumada': { bg: 'rgba(225, 29, 72, 0.22)', text: '#E11D48', border: '#E11D48' },
  'Crítico / Alto Risco': { bg: 'rgba(244, 63, 94, 0.18)', text: '#F43F5E', border: '#F43F5E' },
  'Risco Moderado': { bg: 'rgba(245, 158, 11, 0.16)', text: '#F59E0B', border: '#F59E0B' },
  'Sem Risco': { bg: 'rgba(16, 185, 129, 0.16)', text: '#10B981', border: '#10B981' },

  // Excesso
  'Excesso Crítico': { bg: 'rgba(244, 63, 94, 0.18)', text: '#F43F5E', border: '#F43F5E' },
  'Excesso Elevado': { bg: 'rgba(245, 158, 11, 0.16)', text: '#F59E0B', border: '#F59E0B' },
  'Estoque Normal': { bg: 'rgba(16, 185, 129, 0.16)', text: '#10B981', border: '#10B981' },
};

export default function RiskChip({ label, size = 'small', onClick }) {
  if (!label) return null;

  const style = COLOR_MAP[label] || {
    bg: 'rgba(148, 163, 184, 0.16)',
    text: '#94A3B8',
    border: '#64748B',
  };

  return (
    <Chip
      label={label}
      size={size}
      onClick={onClick}
      clickable={Boolean(onClick)}
      sx={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}44`,
        fontWeight: 700,
        fontSize: size === 'small' ? '0.72rem' : '0.82rem',
        letterSpacing: 0.3,
        '&:hover': onClick
          ? {
              backgroundColor: `${style.bg}`,
              borderColor: style.border,
            }
          : undefined,
      }}
    />
  );
}
