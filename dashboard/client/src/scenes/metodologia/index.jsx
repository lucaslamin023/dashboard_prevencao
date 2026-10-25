import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function Metodologia() {
  const pesos = [
    { fator: 'Prazo de Validade', peso: '22%', desc: 'Proximidade do vencimento do lote (peso maior para lotes < 90 dias)' },
    { fator: 'Dias Sem Venda', peso: '16%', desc: 'Tempo decorrido desde a última saída do SKU na unidade' },
    { fator: 'Dias de Cobertura', peso: '14%', desc: 'Razão entre estoque disponível e ritmo diário de demanda' },
    { fator: 'Perda Histórica (Ano)', peso: '10%', desc: 'Histórico de descarte por validade nos últimos 12 meses' },
    { fator: 'Tendência de Perda', peso: '10%', desc: 'Aceleração de descarte nos meses recentes (regressão temporal)' },
    { fator: 'Divergência de Inventário', peso: '8%', desc: 'Histórico de furos de estoque apurados em contagens' },
    { fator: 'Dias Sem Entrada', peso: '8%', desc: 'Intervalo desde o último recebimento de notas na filial (teto 365d)' },
    { fator: 'Demanda na Rede', peso: '6%', desc: 'Oportunidade de remanejamento caso outras lojas vendam o produto' },
    { fator: 'Concentração de Venda na Maior Filial', peso: '6%', desc: 'Dependência de poucas lojas de alto fluxo para desovar' },
    { fator: 'Bônus de Categoria (Risco Inerente)', peso: 'Até +0,10', desc: 'Ajuste fixo por sensibilidade da categoria (Medicamentos, Higiene, etc.)' },
  ];

  const desvios = [
    { id: 'D1', original: "Rótulos 'Média Alto Risco' ≠ 'Médio Alto Risco' (filtro do bônus falhava)", adotado: "Rótulo padronizado 'Médio-Alto Risco'", motivo: 'Correção de typo para garantir aplicação do bônus' },
    { id: 'D2', original: 'Função normalizar devolvia série sem normalizar com combine_first', adotado: 'Normalização Min-Max correta ignorando zeros', motivo: 'Correção de bug de pipeline no notebook original' },
    { id: 'D3', original: 'Dependência de regras externas regras3.py', adotado: 'Motor de regras reimplementado e testado deterministicamente', motivo: 'Autonomia e reprodutibilidade 100% auditável' },
    { id: 'D4', original: 'Intranet por vencimento duplicava linhas por múltiplos lotes', adotado: '1 linha por par (Filial, SKU) com o menor vencimento', motivo: 'Grão único de visualização no dashboard' },
    { id: 'D5', original: 'dias_desde_ultima_entrada sem teto (anos 1900 geravam 46.000 dias)', adotado: 'Teto (clip) calibrado em 365 dias', motivo: 'Evita distorção estatística da escala normalizada' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <MenuBookIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h2" fontWeight={800}>
            Metodologia & Regras de Negócio
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Documentação técnica dos 4 indicadores de perdas, parâmetros de calibração, pesos e governança dos dados.
          </Typography>
        </Box>
      </Box>

      {/* 4 Indicadores */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h4" fontWeight={700} color="#10B981" gutterBottom>
                1. Monitor de Ruptura
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Mede a saúde de abastecimento com base no tempo de autonomia estimado.
              </Typography>
              <Typography variant="body2">
                • <strong>Ruptura Consumada:</strong> Estoque = 0 e Demanda Atual &gt; 0.<br />
                • <strong>Crítico / Alto Risco:</strong> Dias de Cobertura &lt; 3 dias.<br />
                • <strong>Risco Moderado:</strong> 3 a 7 dias de cobertura.<br />
                • <strong>Sem Risco:</strong> Cobertura &gt; 7 dias.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h4" fontWeight={700} color="#F59E0B" gutterBottom>
                2. Excesso de Estoque
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Identifica capital represado acima da demanda com risco de desvalorização e perda.
              </Typography>
              <Typography variant="body2">
                • <strong>Estoque Normal:</strong> Dias de Cobertura &le; 45 dias.<br />
                • <strong>Excesso Elevado:</strong> 45 a 90 dias de cobertura.<br />
                • <strong>Excesso Crítico:</strong> &gt; 90 dias de cobertura.<br />
                • <strong>Filiais Críticas:</strong> Lojas com mais de 15% das unidades em excesso.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h4" fontWeight={700} color="#8B5CF6" gutterBottom>
                3. Risco Preditivo (ML - Random Forest)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Classificador probabilístico baseado em 10 features operacionais (perdas históricas, vendas AV e divergências).
              </Typography>
              <Alert severity="warning" variant="outlined" sx={{ py: 0.5, fontSize: '0.8rem' }}>
                Rotulado como <strong>indicador experimental</strong> em virtude de dependência parcial com o alvo nos dados históricos.
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h4" fontWeight={700} color="#22D3EE" gutterBottom>
                4. Score de Auditoria (Multi-Fator)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Métrica auditável e explicável que orienta o remanejamento proativo com plano de ação por grupo farmacológico.
              </Typography>
              <Typography variant="body2">
                • <strong>Alto Risco:</strong> Score &gt; 0,30 (prioridade imediata)<br />
                • <strong>Médio-Alto Risco:</strong> Score de 0,20 a 0,30<br />
                • <strong>Médio Risco:</strong> Score de 0,10 a 0,20<br />
                • <strong>Baixo Risco:</strong> Score &le; 0,10
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabela de Pesos do Score */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <VerifiedUserIcon color="primary" />
            <Typography variant="h4" fontWeight={700}>
              Matriz de Ponderação do Score de Auditoria
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pesos estatísticos calibrados sobre a base de 606.457 produtos e 232 filiais.
          </Typography>

          <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Fator de Risco</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Peso Relativo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Critério e Impacto</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pesos.map((p) => (
                  <TableRow key={p.fator}>
                    <TableCell sx={{ fontWeight: 600 }}>{p.fator}</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'primary.main' }}>{p.peso}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{p.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
