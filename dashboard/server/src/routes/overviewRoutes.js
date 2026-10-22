import { Router } from 'express';
import {
  getOverviewKpis,
  getSerieMensal,
  getMixAv,
  getFiliais,
} from '../controllers/overviewController.js';

const router = Router();

router.get('/overview/kpis', getOverviewKpis);
router.get('/overview/serie-mensal', getSerieMensal);
router.get('/overview/mix-av', getMixAv);
router.get('/overview/filiais', getFiliais);

export default router;
