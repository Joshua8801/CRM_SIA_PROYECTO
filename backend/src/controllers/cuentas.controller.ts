import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  actualizarCuenta,
  listarCuentas,
  obtenerCuentaPorId,
  obtenerEstadoCuenta,
} from '../services/cuentas.service';

export async function getCuentas(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const search = req.query.search as string | undefined;
    const soloExcedidas = req.query.solo_excedidas === 'true';
    const cuentas = await listarCuentas({ search, soloExcedidas });
    res.json({ cuentas });
  } catch (error) {
    next(error);
  }
}

export async function getCuentaById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await obtenerCuentaPorId(Number(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function patchCuenta(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const cuenta = await actualizarCuenta(
      Number(req.params.id),
      req.body,
      req.user!.id_usuario
    );
    res.json({ cuenta });
  } catch (error) {
    next(error);
  }
}

export async function getEstadoCuenta(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCuenta = Number(req.params.id);
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const fechaHoy = hoy.toISOString().slice(0, 10);

    const fechaInicio = (req.query.fecha_inicio as string) || primerDia;
    const fechaFin = (req.query.fecha_fin as string) || fechaHoy;

    const estadoCuenta = await obtenerEstadoCuenta(
      idCuenta,
      fechaInicio,
      fechaFin
    );
    res.json(estadoCuenta);
  } catch (error) {
    next(error);
  }
}
