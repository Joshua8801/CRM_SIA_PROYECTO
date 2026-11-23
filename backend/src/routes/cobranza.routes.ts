import { Router } from 'express';
import {
  getGestionById,
  getGestiones,
  getUsuariosCobranza,
  patchCancelarCompromiso,
  patchCerrarGestion,
  patchVincularAbono,
  postCompromiso,
  postGestion,
  postVincularInteraccion,
} from '../controllers/cobranza.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/usuarios', getUsuariosCobranza);
router.get('/', getGestiones);
router.get('/:id', getGestionById);

router.post('/', authorizeRoles('ADMIN', 'ANALISTA'), postGestion);
router.patch(
  '/:id/cerrar',
  authorizeRoles('ADMIN', 'ANALISTA'),
  patchCerrarGestion
);
router.post(
  '/:id/vincular-interaccion',
  authorizeRoles('ADMIN', 'ANALISTA'),
  postVincularInteraccion
);
router.post(
  '/:id/compromisos',
  authorizeRoles('ADMIN', 'ANALISTA'),
  postCompromiso
);
router.patch(
  '/compromisos/:idCompromiso/vincular-abono',
  authorizeRoles('ADMIN', 'ANALISTA'),
  patchVincularAbono
);
router.patch(
  '/compromisos/:idCompromiso/cancelar',
  authorizeRoles('ADMIN', 'ANALISTA'),
  patchCancelarCompromiso
);

export default router;
