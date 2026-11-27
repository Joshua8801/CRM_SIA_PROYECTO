import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  actualizarEstadoAlerta,
  listarAlertas,
} from '../services/alertas.service';
import { parseIdPositivo } from '../utils/validation';

export async function getAlertas(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const estado = req.query.estado as string | undefined;
    const tipo = req.query.tipo as string | undefined;
    const alertas = await listarAlertas({ estado, tipo });
    res.json({ alertas });
  } catch (error) {
    next(error);
  }
}

export async function patchEstadoAlerta(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idAlerta = parseIdPositivo(req.params.id, 'ID de alerta');
    const { estado } = req.body ?? {};
    if (!['REVISADA', 'RESUELTA'].includes(estado)) {
      res.status(400).json({ error: 'Estado inválido. Use REVISADA o RESUELTA.' });
      return;
    }
    const alerta = await actualizarEstadoAlerta(
      idAlerta,
      estado,
      req.user!.id_usuario
    );
    res.json({ alerta });
  } catch (error) {
    next(error);
  }
}
