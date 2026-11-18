import { Router } from 'express';
import {
  getCuentaById,
  getCuentas,
  getEstadoCuenta,
  patchCuenta,
} from '../controllers/cuentas.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getCuentas);
router.get('/:id', getCuentaById);
router.get('/:id/estado-cuenta', getEstadoCuenta);
router.patch('/:id', authorizeRoles('ADMIN', 'ANALISTA'), patchCuenta);

export default router;
