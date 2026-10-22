import { Router } from 'express';
import {
  getRupturaKpis,
  getDistribuicaoRuptura,
  getTabelaRuptura,
  exportRupturaCSV,
} from '../controllers/rupturaController.js';

const router = Router();

router.get('/ruptura/kpis', getRupturaKpis);
router.get('/ruptura/distribuicao', getDistribuicaoRuptura);
router.get('/ruptura/tabela', getTabelaRuptura);
router.get('/ruptura/export', exportRupturaCSV);

export default router;
