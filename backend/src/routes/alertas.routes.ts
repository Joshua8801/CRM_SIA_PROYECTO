import { Router } from 'express';
import { getAlertas, patchEstadoAlerta } from '../controllers/alertas.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getAlertas);
router.patch(
  '/:id/estado',
  authorizeRoles('ADMIN', 'ANALISTA'),
  patchEstadoAlerta
);

export default router;
