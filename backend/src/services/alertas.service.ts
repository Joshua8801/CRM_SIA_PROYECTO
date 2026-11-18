import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { AppError } from '../types';
import { registrarAuditoria } from '../utils/audit';

/**
 * Evalúa la línea de crédito de una cuenta usando el saldo calculado (vw_cuenta_saldo).
 * - Si saldo_actual > linea_credito: genera o actualiza alerta ACTIVA EXCESO_LINEA.
 * - Si saldo_actual >= 85% de linea_credito (y <= linea_credito): genera alerta ACTIVA PROXIMO_LIMITE.
 * - Evita duplicados activos gracias a la verificación + índice único parcial uq_trs_alerta_activa_unica.
 * - Conserva el historial de alertas anteriores marcándolas como RESUELTA cuando corresponde.
 */
export async function evaluarAlertasCuenta(
  client: PoolClient,
  idCuenta: number,
  idMovimientoOrigen: number | null,
  idUsuario: number
): Promise<void> {
  const cuentaRes = await client.query<{
    id_cuenta: number;
    numero_cuenta: string;
    linea_credito: string;
    saldo_actual: string;
  }>(
    `SELECT id_cuenta, numero_cuenta, linea_credito, saldo_actual
     FROM vw_cuenta_saldo
     WHERE id_cuenta = $1`,
    [idCuenta]
  );

  if (cuentaRes.rows.length === 0) return;

  const cuenta = cuentaRes.rows[0];
  const linea = Number(cuenta.linea_credito);
  const saldo = Number(cuenta.saldo_actual);

  if (saldo > linea) {
    const exceso = Number((saldo - linea).toFixed(2));
    const activaExceso = await client.query<{ id_alerta: number }>(
      `SELECT id_alerta FROM trs_alerta_credito
       WHERE id_cuenta = $1 AND tipo_alerta = 'EXCESO_LINEA' AND estado = 'ACTIVA'`,
      [idCuenta]
    );

    if (activaExceso.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO trs_alerta_credito
          (id_cuenta, id_movimiento_origen, tipo_alerta, linea_credito_momento, saldo_momento, monto_excedido, mensaje)
         VALUES ($1, $2, 'EXCESO_LINEA', $3, $4, $5, $6)
         RETURNING *`,
        [
          idCuenta,
          idMovimientoOrigen,
          linea,
          saldo,
          exceso,
          `Cuenta ${cuenta.numero_cuenta} excedió su línea de crédito por ${exceso.toFixed(2)}.`,
        ]
      );
      await registrarAuditoria(client, {
        tablaAfectada: 'trs_alerta_credito',
        idRegistro: ins.rows[0].id_alerta,
        accion: 'INSERT',
        datosNuevos: ins.rows[0],
        idUsuario,
      });
    } else {
      await client.query(
        `UPDATE trs_alerta_credito
         SET linea_credito_momento = $1,
             saldo_momento = $2,
             monto_excedido = $3,
             id_movimiento_origen = COALESCE($4, id_movimiento_origen),
             mensaje = $5
         WHERE id_alerta = $6`,
        [
          linea,
          saldo,
          exceso,
          idMovimientoOrigen,
          `Cuenta ${cuenta.numero_cuenta} excede su línea de crédito por ${exceso.toFixed(2)}.`,
          activaExceso.rows[0].id_alerta,
        ]
      );
    }

    // Resolver alerta preventiva activa porque escaló a EXCESO_LINEA
    await client.query(
      `UPDATE trs_alerta_credito
       SET estado = 'RESUELTA', fecha_resolucion = NOW(), id_usuario_resolucion = $1
       WHERE id_cuenta = $2 AND tipo_alerta = 'PROXIMO_LIMITE' AND estado = 'ACTIVA'`,
      [idUsuario, idCuenta]
    );
    return;
  }

  // Si saldo <= linea: resolver alertas EXCESO_LINEA activas
  await client.query(
    `UPDATE trs_alerta_credito
     SET estado = 'RESUELTA', fecha_resolucion = NOW(), id_usuario_resolucion = $1
     WHERE id_cuenta = $2 AND tipo_alerta = 'EXCESO_LINEA' AND estado = 'ACTIVA'`,
    [idUsuario, idCuenta]
  );

  // Evaluar umbral preventivo del 85%
  if (linea > 0 && saldo >= linea * 0.85) {
    const activaProx = await client.query(
      `SELECT id_alerta FROM trs_alerta_credito
       WHERE id_cuenta = $1 AND tipo_alerta = 'PROXIMO_LIMITE' AND estado = 'ACTIVA'`,
      [idCuenta]
    );
    if (activaProx.rows.length === 0) {
      const porcentaje = ((saldo / linea) * 100).toFixed(1);
      const ins = await client.query(
        `INSERT INTO trs_alerta_credito
          (id_cuenta, id_movimiento_origen, tipo_alerta, linea_credito_momento, saldo_momento, monto_excedido, mensaje)
         VALUES ($1, $2, 'PROXIMO_LIMITE', $3, $4, 0, $5)
         RETURNING *`,
        [
          idCuenta,
          idMovimientoOrigen,
          linea,
          saldo,
          `Cuenta ${cuenta.numero_cuenta} alcanzó el ${porcentaje}% de su línea de crédito.`,
        ]
      );
      await registrarAuditoria(client, {
        tablaAfectada: 'trs_alerta_credito',
        idRegistro: ins.rows[0].id_alerta,
        accion: 'INSERT',
        datosNuevos: ins.rows[0],
        idUsuario,
      });
    }
  } else {
    await client.query(
      `UPDATE trs_alerta_credito
       SET estado = 'RESUELTA', fecha_resolucion = NOW(), id_usuario_resolucion = $1
       WHERE id_cuenta = $2 AND tipo_alerta = 'PROXIMO_LIMITE' AND estado = 'ACTIVA'`,
      [idUsuario, idCuenta]
    );
  }
}

export async function listarAlertas(filtros: {
  estado?: string;
  tipo?: string;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filtros.estado) {
    params.push(filtros.estado);
    conditions.push(`a.estado = $${params.length}`);
  }
  if (filtros.tipo) {
    params.push(filtros.tipo);
    conditions.push(`a.tipo_alerta = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
      a.*,
      vcs.numero_cuenta,
      vcs.linea_credito AS linea_credito_actual,
      vcs.saldo_actual,
      c.id_cliente,
      COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
      c.numero_documento,
      tm.codigo AS moneda_codigo,
      tm.simbolo AS moneda_simbolo,
      u.nombre_completo AS usuario_resolucion
    FROM trs_alerta_credito a
    JOIN vw_cuenta_saldo vcs ON vcs.id_cuenta = a.id_cuenta
    JOIN mae_cliente c ON c.id_cliente = vcs.id_cliente
    JOIN tipo_moneda tm ON tm.id_tipo_moneda = vcs.id_tipo_moneda
    LEFT JOIN mae_usuario u ON u.id_usuario = a.id_usuario_resolucion
    ${whereClause}
    ORDER BY
      CASE a.estado WHEN 'ACTIVA' THEN 1 WHEN 'REVISADA' THEN 2 ELSE 3 END,
      a.fecha_generacion DESC`,
    params
  );

  return result.rows;
}

export async function actualizarEstadoAlerta(
  idAlerta: number,
  estado: 'REVISADA' | 'RESUELTA',
  idUsuario: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prev = await client.query(
      'SELECT * FROM trs_alerta_credito WHERE id_alerta = $1 FOR UPDATE',
      [idAlerta]
    );
    if (prev.rows.length === 0) {
      throw new AppError('Alerta no encontrada.', 404);
    }

    const updated = await client.query(
      `UPDATE trs_alerta_credito
       SET estado = $1::varchar,
           fecha_resolucion = CASE WHEN $1::varchar = 'RESUELTA' THEN NOW() ELSE fecha_resolucion END,
           id_usuario_resolucion = $2
       WHERE id_alerta = $3
       RETURNING *`,
      [estado, idUsuario, idAlerta]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_alerta_credito',
      idRegistro: idAlerta,
      accion: 'UPDATE',
      datosAnteriores: prev.rows[0],
      datosNuevos: updated.rows[0],
      idUsuario,
    });

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
