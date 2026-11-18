import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  crearInteraccion,
  listarInteracciones,
} from '../services/interacciones.service';

export async function getInteracciones(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCliente = req.query.id_cliente
      ? Number(req.query.id_cliente)
      : undefined;
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
    const { id_cliente, id_tipo_interaccion, asunto, detalle } = req.body;
    if (!id_cliente || !id_tipo_interaccion || !asunto || !detalle) {
      res.status(400).json({
        error: 'Cliente, tipo de interacción, asunto y detalle son obligatorios.',
      });
      return;
    }
    const interaccion = await crearInteraccion(
      req.body,
      req.user!.id_usuario
    );
    res.status(201).json({ interaccion });
  } catch (error) {
    next(error);
  }
}
