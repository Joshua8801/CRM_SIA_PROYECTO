import { Router } from 'express';
import {
  getInteracciones,
  postInteraccion,
} from '../controllers/interacciones.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getInteracciones);
router.post('/', authorizeRoles('ADMIN', 'ANALISTA'), postInteraccion);

export default router;
