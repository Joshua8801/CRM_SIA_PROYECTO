import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  abrirGestion,
  cancelarCompromiso,
  cerrarGestion,
  crearCompromisoPago,
  listarGestiones,
  listarUsuariosActivos,
  obtenerGestionPorId,
  vincularAbonoACompromiso,
  vincularInteraccionAGestion,
} from '../services/cobranza.service';
import { parseIdOpcional, parseIdPositivo } from '../utils/validation';

export async function getUsuariosCobranza(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarios = await listarUsuariosActivos();
    res.json({ usuarios });
  } catch (error) {
    next(error);
  }
}

export async function getGestiones(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const estado = req.query.estado as string | undefined;
    const id_cuenta = parseIdOpcional(req.query.id_cuenta, 'ID de cuenta');
    const gestiones = await listarGestiones({ estado, id_cuenta });
    res.json({ gestiones });
  } catch (error) {
    next(error);
  }
}

export async function getGestionById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idGestion = parseIdPositivo(req.params.id, 'ID de gestión');
    const data = await obtenerGestionPorId(idGestion);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function postGestion(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id_cuenta, id_usuario_responsable, motivo } = req.body ?? {};
    if (id_cuenta === undefined || typeof motivo !== 'string' || !motivo.trim()) {
      res
        .status(400)
        .json({ error: 'La cuenta corriente y el motivo son obligatorios.' });
      return;
    }
    const idCuenta = parseIdPositivo(id_cuenta, 'Cuenta corriente');
    const idResp = parseIdOpcional(
      id_usuario_responsable,
      'Usuario responsable'
    );
    const gestion = await abrirGestion(
      {
        id_cuenta: idCuenta,
        id_usuario_responsable: idResp,
        motivo,
      },
      req.user!.id_usuario
    );
    res.status(201).json({ gestion });
  } catch (error) {
    next(error);
  }
}

export async function patchCerrarGestion(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idGestion = parseIdPositivo(req.params.id, 'ID de gestión');
    const gestion = await cerrarGestion(
      idGestion,
      req.body?.observaciones_cierre,
      req.user!.id_usuario
    );
    res.json({ gestion });
  } catch (error) {
    next(error);
  }
}

export async function postVincularInteraccion(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idGestion = parseIdPositivo(req.params.id, 'ID de gestión');
    const { id_interaccion } = req.body ?? {};
    if (id_interaccion === undefined) {
      res.status(400).json({ error: 'Debe seleccionar una interacción.' });
      return;
    }
    const idInteraccion = parseIdPositivo(id_interaccion, 'Interacción');
    const interaccion = await vincularInteraccionAGestion(
      idGestion,
      idInteraccion,
      req.user!.id_usuario
    );
    res.json({ interaccion });
  } catch (error) {
    next(error);
  }
}

export async function postCompromiso(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idGestion = parseIdPositivo(req.params.id, 'ID de gestión');
    const { fecha_pactada, monto_comprometido, observacion } = req.body ?? {};
    if (
      fecha_pactada === undefined ||
      monto_comprometido === undefined ||
      monto_comprometido === null
    ) {
      res.status(400).json({
        error: 'La fecha pactada y el monto comprometido son obligatorios.',
      });
      return;
    }
    const compromiso = await crearCompromisoPago(
      idGestion,
      {
        fecha_pactada,
        monto_comprometido,
        observacion,
      },
      req.user!.id_usuario
    );
    res.status(201).json({ compromiso });
  } catch (error) {
    next(error);
  }
}

export async function patchVincularAbono(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCompromiso = parseIdPositivo(
      req.params.idCompromiso,
      'ID de compromiso'
    );
    const { id_movimiento_abono } = req.body ?? {};
    if (id_movimiento_abono === undefined) {
      res.status(400).json({ error: 'Debe seleccionar un abono válido.' });
      return;
    }
    const idAbono = parseIdPositivo(id_movimiento_abono, 'ID de abono');
    const compromiso = await vincularAbonoACompromiso(
      idCompromiso,
      idAbono,
      req.user!.id_usuario
    );
    res.json({ compromiso });
  } catch (error) {
    next(error);
  }
}

export async function patchCancelarCompromiso(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCompromiso = parseIdPositivo(
      req.params.idCompromiso,
      'ID de compromiso'
    );
    const compromiso = await cancelarCompromiso(
      idCompromiso,
      req.user!.id_usuario
    );
    res.json({ compromiso });
  } catch (error) {
    next(error);
  }
}
