import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  listarConciliaciones,
  previsualizarConciliacion,
  registrarConciliacion,
} from '../services/conciliaciones.service';
import { parseIdOpcional, parseIdPositivo } from '../utils/validation';

export async function getConciliaciones(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCuenta = parseIdOpcional(req.query.id_cuenta, 'ID de cuenta');
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
    if (
      req.query.id_cuenta === undefined ||
      req.query.fecha_inicio === undefined ||
      req.query.fecha_fin === undefined
    ) {
      res.status(400).json({
        error: 'Debe indicar id_cuenta, fecha_inicio y fecha_fin.',
      });
      return;
    }
    const idCuenta = parseIdPositivo(req.query.id_cuenta, 'ID de cuenta');
    const fechaInicio = req.query.fecha_inicio as string;
    const fechaFin = req.query.fecha_fin as string;

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
      fecha_inicio === undefined ||
      fecha_fin === undefined ||
      saldo_inicial_manual === undefined ||
      saldo_inicial_manual === null ||
      total_cargos_manual === undefined ||
      total_cargos_manual === null ||
      total_abonos_manual === undefined ||
      total_abonos_manual === null ||
      saldo_final_manual === undefined ||
      saldo_final_manual === null
    ) {
      res.status(400).json({
        error: 'Todos los campos del período y cálculo manual son obligatorios.',
      });
      return;
    }

    const idCuenta = parseIdPositivo(id_cuenta, 'ID de cuenta');
    const conciliacion = await registrarConciliacion(
      { ...req.body, id_cuenta: idCuenta },
      req.user!.id_usuario
    );
    res.status(201).json({ conciliacion });
  } catch (error) {
    next(error);
  }
}
