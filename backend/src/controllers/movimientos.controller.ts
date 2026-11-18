import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  anularMovimiento,
  aplicarPago,
  listarPendientesPorCuenta,
  registrarMovimiento,
} from '../services/movimientos.service';

export async function postMovimiento(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id_cuenta, id_tipo_movimiento, monto, glosa } = req.body;
    if (!id_cuenta || !id_tipo_movimiento || !monto || !glosa) {
      res.status(400).json({
        error: 'Cuenta, tipo de movimiento, monto y glosa son obligatorios.',
      });
      return;
    }
    const movimiento = await registrarMovimiento(
      req.body,
      req.user!.id_usuario
    );
    res.status(201).json({ movimiento });
  } catch (error) {
    next(error);
  }
}

export async function postAplicarPago(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id_movimiento_abono, id_movimiento_cargo, monto_aplicado } =
      req.body;
    if (!id_movimiento_abono || !id_movimiento_cargo || !monto_aplicado) {
      res.status(400).json({
        error: 'Debe indicar abono, cargo y monto aplicado.',
      });
      return;
    }
    const aplicacion = await aplicarPago(
      Number(id_movimiento_abono),
      Number(id_movimiento_cargo),
      Number(monto_aplicado),
      req.user!.id_usuario
    );
    res.status(201).json({ aplicacion });
  } catch (error) {
    next(error);
  }
}

export async function postAnularMovimiento(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const movimiento = await anularMovimiento(
      Number(req.params.id),
      req.user!.id_usuario
    );
    res.json({ movimiento });
  } catch (error) {
    next(error);
  }
}

export async function getPendientesPorCuenta(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const pendientes = await listarPendientesPorCuenta(
      Number(req.params.idCuenta)
    );
    res.json({ pendientes });
  } catch (error) {
    next(error);
  }
}
