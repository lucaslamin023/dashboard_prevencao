import { Router } from 'express';
import {
  getExcessoKpis,
  getTreemap,
  getPorCategoria,
  getFiliaisExcesso,
} from '../controllers/excessoController.js';

const router = Router();

router.get('/excesso/kpis', getExcessoKpis);
router.get('/excesso/treemap', getTreemap);
router.get('/excesso/por-categoria', getPorCategoria);
router.get('/excesso/filiais', getFiliaisExcesso);

export default router;
