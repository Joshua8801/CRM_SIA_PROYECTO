import { Router } from 'express';
import {
  getPendientesPorCuenta,
  postAnularMovimiento,
  postAplicarPago,
  postMovimiento,
} from '../controllers/movimientos.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/pendientes/:idCuenta', getPendientesPorCuenta);
router.post('/', authorizeRoles('ADMIN', 'ANALISTA'), postMovimiento);
router.post(
  '/aplicar-pago',
  authorizeRoles('ADMIN', 'ANALISTA'),
  postAplicarPago
);
router.post(
  '/:id/anular',
  authorizeRoles('ADMIN', 'ANALISTA'),
  postAnularMovimiento
);

export default router;
