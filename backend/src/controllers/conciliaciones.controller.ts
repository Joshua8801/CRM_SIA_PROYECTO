import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  listarConciliaciones,
  previsualizarConciliacion,
  registrarConciliacion,
} from '../services/conciliaciones.service';

export async function getConciliaciones(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCuenta = req.query.id_cuenta
      ? Number(req.query.id_cuenta)
      : undefined;
    const conciliaciones = await listarConciliaciones(idCuenta);
    res.json({ conciliaciones });
  } catch (error) {
    next(error);
  }
}

export async function getPreviewConciliacion(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCuenta = Number(req.query.id_cuenta);
    const fechaInicio = req.query.fecha_inicio as string;
    const fechaFin = req.query.fecha_fin as string;

    if (!idCuenta || !fechaInicio || !fechaFin) {
      res.status(400).json({
        error: 'Debe indicar id_cuenta, fecha_inicio y fecha_fin.',
      });
      return;
    }

    const preview = await previsualizarConciliacion(
      idCuenta,
      fechaInicio,
      fechaFin
    );
    res.json(preview);
  } catch (error) {
    next(error);
  }
}

export async function postConciliacion(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      id_cuenta,
      fecha_inicio,
      fecha_fin,
      saldo_inicial_manual,
      total_cargos_manual,
      total_abonos_manual,
      saldo_final_manual,
    } = req.body;

    if (
      !id_cuenta ||
      !fecha_inicio ||
      !fecha_fin ||
      saldo_inicial_manual === undefined ||
      total_cargos_manual === undefined ||
      total_abonos_manual === undefined ||
      saldo_final_manual === undefined
    ) {
      res.status(400).json({
        error: 'Todos los campos del período y cálculo manual son obligatorios.',
      });
      return;
    }

    const conciliacion = await registrarConciliacion(
      req.body,
      req.user!.id_usuario
    );
    res.status(201).json({ conciliacion });
  } catch (error) {
    next(error);
  }
}
