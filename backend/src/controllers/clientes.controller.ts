import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  abrirCuentaCliente,
  actualizarCliente,
  crearCliente,
  listarClientes,
  obtenerClientePorId,
} from '../services/clientes.service';

export async function getClientes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const search = req.query.search as string | undefined;
    const id_segmento = req.query.id_segmento
      ? Number(req.query.id_segmento)
      : undefined;
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
    const cliente = await obtenerClientePorId(Number(req.params.id));
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
      req.body;
    if (
      !tipo_persona ||
      !id_tipo_documento ||
      !numero_documento ||
      !id_segmento
    ) {
      res.status(400).json({
        error:
          'Tipo de persona, tipo de documento, número de documento y segmento son obligatorios.',
      });
      return;
    }
    const cliente = await crearCliente(req.body, req.user!.id_usuario);
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
    const cliente = await actualizarCliente(
      Number(req.params.id),
      req.body,
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
    const { id_tipo_moneda, linea_credito } = req.body;
    if (!id_tipo_moneda || linea_credito === undefined) {
      res.status(400).json({
        error: 'La moneda y la línea de crédito son obligatorias.',
      });
      return;
    }
    const cuenta = await abrirCuentaCliente(
      Number(req.params.id),
      {
        id_tipo_moneda: Number(id_tipo_moneda),
        linea_credito: Number(linea_credito),
      },
      req.user!.id_usuario
    );
    res.status(201).json({ cuenta });
  } catch (error) {
    next(error);
  }
}
