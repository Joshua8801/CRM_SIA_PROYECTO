import { Router } from 'express';
import { obtenerCatalogos } from '../controllers/catalogos.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateToken, obtenerCatalogos);

export default router;
