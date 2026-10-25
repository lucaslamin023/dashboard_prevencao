import { Router } from 'express';
import {
  getInventarioKpis,
  getEvolucaoAcuracidade,
  getUltimoInventarioFiliais,
  getDivergenciasCategoria,
  getTopDivergenciasProdutos,
} from '../controllers/inventarioController.js';

const router = Router();

router.get('/kpis', getInventarioKpis);
router.get('/evolucao', getEvolucaoAcuracidade);
router.get('/ultimo-inventario', getUltimoInventarioFiliais);
router.get('/divergencias-categoria', getDivergenciasCategoria);
router.get('/top-produtos', getTopDivergenciasProdutos);

export default router;
