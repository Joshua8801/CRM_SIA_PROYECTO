import { Router } from 'express';
import {
  getConciliaciones,
  getPreviewConciliacion,
  postConciliacion,
} from '../controllers/conciliaciones.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getConciliaciones);
router.get('/preview', getPreviewConciliacion);
router.post('/', authorizeRoles('ADMIN', 'ANALISTA'), postConciliacion);

export default router;
