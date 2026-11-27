import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  abrirCuentaCliente,
  actualizarCliente,
  crearCliente,
  listarClientes,
  obtenerClientePorId,
} from '../services/clientes.service';
import { parseIdOpcional, parseIdPositivo } from '../utils/validation';

export async function getClientes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const search = req.query.search as string | undefined;
    const id_segmento = parseIdOpcional(req.query.id_segmento, 'Segmento');
    const estado = req.query.estado as string | undefined;
    const tipo_persona = req.query.tipo_persona as string | undefined;

    const clientes = await listarClientes({
      search,
      id_segmento,
      estado,
      tipo_persona,
    });
    res.json({ clientes });
  } catch (error) {
    next(error);
  }
}

export async function getClienteById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCliente = parseIdPositivo(req.params.id, 'ID de cliente');
    const cliente = await obtenerClientePorId(idCliente);
    res.json({ cliente });
  } catch (error) {
    next(error);
  }
}

export async function postCliente(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { tipo_persona, id_tipo_documento, numero_documento, id_segmento } =
      req.body ?? {};
    if (
      !tipo_persona ||
      id_tipo_documento === undefined ||
      typeof numero_documento !== 'string' ||
      !numero_documento.trim() ||
      id_segmento === undefined
    ) {
      res.status(400).json({
        error:
          'Tipo de persona, tipo de documento, número de documento y segmento son obligatorios.',
      });
      return;
    }
    const idTipoDoc = parseIdPositivo(id_tipo_documento, 'Tipo de documento');
    const idSeg = parseIdPositivo(id_segmento, 'Segmento');
    const idMoneda = parseIdOpcional(req.body.id_tipo_moneda, 'Tipo de moneda');
    const cliente = await crearCliente(
      {
        ...req.body,
        id_tipo_documento: idTipoDoc,
        id_segmento: idSeg,
        id_tipo_moneda: idMoneda,
      },
      req.user!.id_usuario
    );
    res.status(201).json({ cliente });
  } catch (error) {
    next(error);
  }
}

export async function putCliente(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCliente = parseIdPositivo(req.params.id, 'ID de cliente');
    const idSeg = parseIdOpcional(req.body?.id_segmento, 'Segmento');
    const cliente = await actualizarCliente(
      idCliente,
      { ...req.body, id_segmento: idSeg },
      req.user!.id_usuario
    );
    res.json({ cliente });
  } catch (error) {
    next(error);
  }
}

export async function postCuentaCliente(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const idCliente = parseIdPositivo(req.params.id, 'ID de cliente');
    const { id_tipo_moneda, linea_credito } = req.body ?? {};
    if (id_tipo_moneda === undefined || linea_credito === undefined) {
      res.status(400).json({
        error: 'La moneda y la línea de crédito son obligatorias.',
      });
      return;
    }
    const idMoneda = parseIdPositivo(id_tipo_moneda, 'Tipo de moneda');
    const cuenta = await abrirCuentaCliente(
      idCliente,
      {
        id_tipo_moneda: idMoneda,
        linea_credito,
      },
      req.user!.id_usuario
    );
    res.status(201).json({ cuenta });
  } catch (error) {
    next(error);
  }
}
