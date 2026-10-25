import { Router } from 'express';
import {
  getVendasAvKpis,
  getEvolucaoMensal,
  getTopVendedores,
  getPorCategoria,
  getTabelaVendasAv,
} from '../controllers/vendasAvController.js';

const router = Router();

router.get('/kpis', getVendasAvKpis);
router.get('/evolucao', getEvolucaoMensal);
router.get('/top-vendedores', getTopVendedores);
router.get('/por-categoria', getPorCategoria);
router.get('/tabela', getTabelaVendasAv);

export default router;
