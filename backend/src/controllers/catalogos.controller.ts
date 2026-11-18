import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';

export async function obtenerCatalogos(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const [
      tiposDocumento,
      tiposMoneda,
      segmentos,
      tiposMovimiento,
      tiposInteraccion,
      estadosMovimiento,
    ] = await Promise.all([
      pool.query(
        'SELECT * FROM tipo_documento WHERE activo = TRUE ORDER BY id_tipo_documento'
      ),
      pool.query(
        'SELECT * FROM tipo_moneda WHERE activo = TRUE ORDER BY id_tipo_moneda'
      ),
      pool.query(
        'SELECT * FROM cat_segmento_cliente WHERE activo = TRUE ORDER BY id_segmento'
      ),
      pool.query(
        'SELECT * FROM tipo_movimiento_cuenta WHERE activo = TRUE ORDER BY id_tipo_movimiento'
      ),
      pool.query(
        'SELECT * FROM tipo_interaccion WHERE activo = TRUE ORDER BY id_tipo_interaccion'
      ),
      pool.query(
        'SELECT * FROM tipo_estado_movimiento WHERE activo = TRUE ORDER BY id_estado_movimiento'
      ),
    ]);

    res.json({
      tiposDocumento: tiposDocumento.rows,
      tiposMoneda: tiposMoneda.rows,
      segmentos: segmentos.rows,
      tiposMovimiento: tiposMovimiento.rows,
      tiposInteraccion: tiposInteraccion.rows,
      estadosMovimiento: estadosMovimiento.rows,
    });
  } catch (error) {
    next(error);
  }
}
