import { Router } from 'express';
import { getHealth, getFiltros } from '../controllers/metaController.js';

const router = Router();

router.get('/health', getHealth);
router.get('/meta/filtros', getFiltros);

export default router;
