/**
 * Utilitários de formatação pt-BR para números, moedas e porcentagens.
 */

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

export function formatCurrency(val) {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return currencyFormatter.format(val);
}

export function formatNumber(val, decimals = 0) {
  if (val === undefined || val === null || isNaN(val)) return '0';
  if (decimals === 0) {
    return numberFormatter.format(Math.round(val));
  }
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatPercent(val, decimals = 1) {
  if (val === undefined || val === null || isNaN(val)) return '0,0%';
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val)}%`;
}

export function formatShortCurrency(val) {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1000000) {
    return `${sign}R$ ${(abs / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1000) {
    return `${sign}R$ ${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return `${sign}R$ ${abs.toFixed(0)}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Formato YYYY-MM-DD
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(dateStr);
}

export default {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShortCurrency,
  formatDate,
};
