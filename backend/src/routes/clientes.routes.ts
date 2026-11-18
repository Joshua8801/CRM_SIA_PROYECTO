import { Router } from 'express';
import {
  getClienteById,
  getClientes,
  postCliente,
  putCliente,
} from '../controllers/clientes.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getClientes);
router.get('/:id', getClienteById);
router.post('/', authorizeRoles('ADMIN', 'ANALISTA'), postCliente);
router.put('/:id', authorizeRoles('ADMIN', 'ANALISTA'), putCliente);

export default router;
