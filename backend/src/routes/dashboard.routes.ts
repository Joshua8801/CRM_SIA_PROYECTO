import { Router } from 'express';
import { obtenerResumenDashboard } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateToken, obtenerResumenDashboard);

export default router;
