import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  anularMovimiento,
  aplicarPago,
  listarPendientesPorCuenta,
  registrarMovimiento,
} from '../services/movimientos.service';
import { parseIdOpcional, parseIdPositivo } from '../utils/validation';

export async function postMovimiento(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id_cuenta, id_tipo_movimiento, monto, glosa } = req.body ?? {};
    if (
      id_cuenta === undefined ||
      id_tipo_movimiento === undefined ||
      monto === undefined ||
      monto === null ||
      glosa === undefined ||
      glosa === null
    ) {
      res.status(400).json({
        error: 'Cuenta, tipo de movimiento, monto y glosa son obligatorios.',
      });
      return;
    }
    const idCuenta = parseIdPositivo(id_cuenta, 'Cuenta corriente');
    const idTipo = parseIdPositivo(id_tipo_movimiento, 'Tipo de movimiento');
    const idCargo = parseIdOpcional(
      req.body.id_cargo_a_aplicar,
      'Cargo a aplicar'
    );
    const movimiento = await registrarMovimiento(
      {
        ...req.body,
        id_cuenta: idCuenta,
        id_tipo_movimiento: idTipo,
        id_cargo_a_aplicar: idCargo ?? null,
      },
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
      req.body ?? {};
    if (
      id_movimiento_abono === undefined ||
      id_movimiento_cargo === undefined ||
      monto_aplicado === undefined ||
      monto_aplicado === null
    ) {
      res.status(400).json({
        error: 'Debe indicar abono, cargo y monto aplicado.',
      });
      return;
    }
    const idAbono = parseIdPositivo(id_movimiento_abono, 'ID de abono');
    const idCargo = parseIdPositivo(id_movimiento_cargo, 'ID de cargo');
    const aplicacion = await aplicarPago(
      idAbono,
      idCargo,
      monto_aplicado,
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
    const idMovimiento = parseIdPositivo(req.params.id, 'ID de movimiento');
    const movimiento = await anularMovimiento(
      idMovimiento,
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
    const idCuenta = parseIdPositivo(req.params.idCuenta, 'ID de cuenta');
    const pendientes = await listarPendientesPorCuenta(idCuenta);
    res.json({ pendientes });
  } catch (error) {
    next(error);
  }
}
