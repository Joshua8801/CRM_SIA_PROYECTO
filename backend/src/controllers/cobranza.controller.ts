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
    const id_cuenta = req.query.id_cuenta
      ? Number(req.query.id_cuenta)
      : undefined;
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
    const data = await obtenerGestionPorId(Number(req.params.id));
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
    const { id_cuenta, id_usuario_responsable, motivo } = req.body;
    if (!id_cuenta || !motivo) {
      res
        .status(400)
        .json({ error: 'La cuenta corriente y el motivo son obligatorios.' });
      return;
    }
    const gestion = await abrirGestion(
      {
        id_cuenta: Number(id_cuenta),
        id_usuario_responsable: id_usuario_responsable
          ? Number(id_usuario_responsable)
          : undefined,
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
    const gestion = await cerrarGestion(
      Number(req.params.id),
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
    const { id_interaccion } = req.body;
    if (!id_interaccion) {
      res.status(400).json({ error: 'Debe seleccionar una interacción.' });
      return;
    }
    const interaccion = await vincularInteraccionAGestion(
      Number(req.params.id),
      Number(id_interaccion),
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
    const { fecha_pactada, monto_comprometido, observacion } = req.body;
    if (!fecha_pactada || monto_comprometido === undefined) {
      res.status(400).json({
        error: 'La fecha pactada y el monto comprometido son obligatorios.',
      });
      return;
    }
    const compromiso = await crearCompromisoPago(
      Number(req.params.id),
      {
        fecha_pactada,
        monto_comprometido: Number(monto_comprometido),
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
    const { id_movimiento_abono } = req.body;
    if (!id_movimiento_abono) {
      res.status(400).json({ error: 'Debe seleccionar un abono válido.' });
      return;
    }
    const compromiso = await vincularAbonoACompromiso(
      Number(req.params.idCompromiso),
      Number(id_movimiento_abono),
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
    const compromiso = await cancelarCompromiso(
      Number(req.params.idCompromiso),
      req.user!.id_usuario
    );
    res.json({ compromiso });
  } catch (error) {
    next(error);
  }
}
