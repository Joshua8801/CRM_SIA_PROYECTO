import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  crearInteraccion,
  listarInteracciones,
} from '../services/interacciones.service';
import { parseIdOpcional, parseIdPositivo } from '../utils/validation';

export async function getInteracciones(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCliente = parseIdOpcional(req.query.id_cliente, 'ID de cliente');
    const interacciones = await listarInteracciones(idCliente);
    res.json({ interacciones });
  } catch (error) {
    next(error);
  }
}

export async function postInteraccion(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id_cliente, id_tipo_interaccion, asunto, detalle } = req.body ?? {};
    if (
      id_cliente === undefined ||
      id_tipo_interaccion === undefined ||
      asunto === undefined ||
      detalle === undefined
    ) {
      res.status(400).json({
        error: 'Cliente, tipo de interacción, asunto y detalle son obligatorios.',
      });
      return;
    }
    const idCliente = parseIdPositivo(id_cliente, 'Cliente');
    const idTipo = parseIdPositivo(
      id_tipo_interaccion,
      'Tipo de interacción'
    );
    const interaccion = await crearInteraccion(
      {
        ...req.body,
        id_cliente: idCliente,
        id_tipo_interaccion: idTipo,
      },
      req.user!.id_usuario
    );
    res.status(201).json({ interaccion });
  } catch (error) {
    next(error);
  }
}
