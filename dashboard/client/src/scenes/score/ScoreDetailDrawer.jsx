import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Grid,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import RiskChip from '../../components/RiskChip.jsx';
import { useGetScoreProdutoDetalheQuery } from '../../state/api.js';
import { formatCurrency, formatPercent, formatDate } from '../../utils/format.js';

export default function ScoreDetailDrawer({ open, onClose, selectedProduct }) {
  const { data, isLoading } = useGetScoreProdutoDetalheQuery(
    selectedProduct
      ? { filial: selectedProduct.filial, codigo: selectedProduct.codigo }
      : { filial: 0, codigo: 0 },
    { skip: !selectedProduct }
  );

  const produto = data?.produto;
  const explicacao = data?.explicacao || [];
  const lotes = data?.lotes || [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 2,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 600, md: 680 },
          p: 3,
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? '#0F172A' : '#FFFFFF',
          backgroundImage: 'none',
        },
      }}
    >
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="caption" color="primary" fontWeight={700} textTransform="uppercase" letterSpacing={1}>
            Auditoria & Explicabilidade de Risco
          </Typography>
          <Typography variant="h3" fontWeight={800} sx={{ mt: 0.5 }}>
            {produto?.Nome_Produto || 'Detalhe do Produto'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Código: #{produto?.Codigo_Produto} • Filial: #{produto?.Filial} ({produto?.Nome_Filial})
          </Typography>
        </Box>
        <IconButton id="btn-fechar-drawer-score" onClick={onClose} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Carregando fatores de auditoria e lotes...
          </Typography>
        </Box>
      ) : produto ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Card Resumo do Score e Classificação */}
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 2,
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Score Auditoria</Typography>
                <Typography variant="h3" fontWeight={800} color="primary.main">
                  {produto?.Score_Auditoria?.toFixed(3) || '0.000'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Classificação</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <RiskChip label={produto?.Classificacao_Risco_Auditoria} />
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Grupo / Curva</Typography>
                <Typography variant="body1" fontWeight={700}>
                  {produto?.Grupo || 'Z0Z0'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Valor Estoque</Typography>
                <Typography variant="body1" fontWeight={700}>
                  {formatCurrency(produto?.Valor_Estoque_Custo)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Caixa de Ação Recomendada */}
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 2,
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(34, 211, 238, 0.08)' : 'rgba(2, 132, 199, 0.08)',
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AssignmentIcon color="primary" fontSize="small" />
              <Typography variant="h4" fontWeight={700} color="primary.main">
                Ação Operacional Recomendada
              </Typography>
            </Box>
            <Typography variant="body1" fontWeight={600} sx={{ mb: 1 }}>
              {produto?.Acao_Recomendada || 'Nenhuma ação prioritária necessária.'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Princípio Ativo: <strong>{produto?.Principio_Ativo || 'N/A'}</strong> • Demanda Rede: {produto?.Demanda_Rede || 0} un • Vendas PA Filial: {produto?.Vendas_PA_Filial || 0} un
            </Typography>
          </Paper>

          {/* Seção Explicabilidade: "Por que este score?" */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <HelpOutlineIcon fontSize="small" color="secondary" />
              <Typography variant="h4" fontWeight={700}>
                Por que este score? (Decomposição das Contribuições)
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Ordenado por impacto decrescente. Itens em destaque representam as principais causas de risco que justificam a ação.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {explicacao.map((fator) => (
                <Box
                  key={fator.chave}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: fator.relevante
                      ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(51, 65, 85, 0.4)' : '#F1F5F9')
                      : 'transparent',
                    border: '1px solid',
                    borderColor: fator.relevante ? 'primary.main' : 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {fator.nome}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Bruto: <strong>{fator.valor_bruto}</strong>
                      </Typography>
                      <Typography variant="body2" fontWeight={800} color={fator.contrib > 0.05 ? 'error.main' : 'inherit'}>
                        +{fator.contrib.toFixed(3)}
                      </Typography>
                    </Box>
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, ((fator.contrib || 0) / (fator.peso || 0.01)) * 100))}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: 'rgba(100, 116, 139, 0.2)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: fator.contrib > 0.08 ? '#EF4444' : fator.contrib > 0.03 ? '#F59E0B' : '#10B981',
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.4 }}>
                    <Typography variant="caption" color="text.secondary">
                      Peso da regra: <strong>{((fator.peso || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Impacto no risco: <strong>{Math.round(Math.min(100, ((fator.contrib || 0) / (fator.peso || 0.01)) * 100))}%</strong>
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Seção Lotes a Vencer */}
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Lotes Cadastrados a Vencer ({lotes.length})
            </Typography>
            {lotes.length > 0 ? (
              <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Lote</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Vencimento</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Estoque</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Custo</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Total AV</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lotes.map((lote) => (
                      <TableRow key={lote.id}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{lote.lote}</TableCell>
                        <TableCell>{formatDate(lote.vencimento)}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{lote.estoque} un</TableCell>
                        <TableCell>{formatCurrency(lote.custo_unitario)}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: 'warning.main' }}>
                          {formatCurrency(lote.total_av)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Nenhum lote com alerta de vencimento registrado na filial.
              </Typography>
            )}
          </Box>
        </Box>
      ) : null}
    </Drawer>
  );
}
