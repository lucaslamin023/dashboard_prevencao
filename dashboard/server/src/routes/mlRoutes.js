import { Router } from 'express';
import {
  getMlKpis,
  getTopProdutos,
  getScatter,
  getTabelaMl,
} from '../controllers/mlController.js';

const router = Router();

router.get('/risco-ml/kpis', getMlKpis);
router.get('/risco-ml/top-produtos', getTopProdutos);
router.get('/risco-ml/scatter', getScatter);
router.get('/risco-ml/tabela', getTabelaMl);

export default router;
