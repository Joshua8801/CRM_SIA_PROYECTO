import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';

export async function obtenerResumenDashboard(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const [kpisRes, alertasRes, seguimientosRes, segmentosRes] =
      await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM mae_cliente WHERE estado = 'ACTIVO')::int AS clientes_activos,
            (SELECT COUNT(*) FROM mae_cuenta_corriente WHERE estado = 'ACTIVA')::int AS cuentas_activas,
            (SELECT COALESCE(SUM(saldo_actual), 0) FROM vw_cuenta_saldo WHERE saldo_actual > 0)::numeric(14,2) AS cartera_por_cobrar,
            (SELECT COALESCE(SUM(linea_credito), 0) FROM mae_cuenta_corriente WHERE estado = 'ACTIVA')::numeric(14,2) AS linea_credito_total,
            (SELECT COUNT(*) FROM trs_alerta_credito WHERE estado = 'ACTIVA')::int AS alertas_activas,
            (SELECT COUNT(*) FROM vw_cuenta_saldo WHERE excede_linea = TRUE AND estado = 'ACTIVA')::int AS cuentas_excedidas
        `),
        pool.query(`
          SELECT
            a.id_alerta,
            a.id_cuenta,
            a.tipo_alerta,
            a.linea_credito_momento,
            a.saldo_momento,
            a.monto_excedido,
            a.mensaje,
            a.estado,
            a.fecha_generacion,
            cc.numero_cuenta,
            c.id_cliente,
            COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
            tm.simbolo AS moneda_simbolo
          FROM trs_alerta_credito a
          JOIN mae_cuenta_corriente cc ON cc.id_cuenta = a.id_cuenta
          JOIN mae_cliente c ON c.id_cliente = cc.id_cliente
          JOIN tipo_moneda tm ON tm.id_tipo_moneda = cc.id_tipo_moneda
          WHERE a.estado = 'ACTIVA'
          ORDER BY a.fecha_generacion DESC
          LIMIT 6
        `),
        pool.query(`
          SELECT
            i.id_interaccion,
            i.id_cliente,
            COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
            ti.nombre AS tipo_interaccion,
            i.asunto,
            i.resultado,
            i.fecha_proximo_seguimiento
          FROM trs_interaccion_cliente i
          JOIN mae_cliente c ON c.id_cliente = i.id_cliente
          JOIN tipo_interaccion ti ON ti.id_tipo_interaccion = i.id_tipo_interaccion
          WHERE i.fecha_proximo_seguimiento IS NOT NULL
          ORDER BY i.fecha_proximo_seguimiento ASC
          LIMIT 6
        `),
        pool.query(`
          SELECT
            s.nombre AS segmento,
            COUNT(DISTINCT c.id_cliente)::int AS cantidad_clientes,
            COALESCE(SUM(vcs.saldo_actual), 0)::numeric(14,2) AS saldo_total
          FROM cat_segmento_cliente s
          LEFT JOIN mae_cliente c ON c.id_segmento = s.id_segmento AND c.estado <> 'INACTIVO'
          LEFT JOIN vw_cuenta_saldo vcs ON vcs.id_cliente = c.id_cliente
          GROUP BY s.id_segmento, s.nombre
          ORDER BY s.id_segmento
        `),
      ]);

    res.json({
      kpis: kpisRes.rows[0],
      alertasRecientes: alertasRes.rows,
      proximosSeguimientos: seguimientosRes.rows,
      resumenSegmentos: segmentosRes.rows,
    });
  } catch (error) {
    next(error);
  }
}
