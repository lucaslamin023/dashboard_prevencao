import { Router } from 'express';
import {
  getScoreKpis,
  getDistribuicaoScore,
  getAcoesRecomendadas,
  getHeatmap,
  getTabelaScore,
  exportScoreCSV,
  getProdutoDetalhe,
} from '../controllers/scoreController.js';

const router = Router();

router.get('/score/kpis', getScoreKpis);
router.get('/score/distribuicao', getDistribuicaoScore);
router.get('/score/acoes', getAcoesRecomendadas);
router.get('/score/heatmap', getHeatmap);
router.get('/score/tabela', getTabelaScore);
router.get('/score/export', exportScoreCSV);
router.get('/score/produto/:filial/:codigo', getProdutoDetalhe);

export default router;
