import { pool, withTransaction } from '../config/db';
import { AppError } from '../types';
import { registrarAuditoria } from '../utils/audit';
import { validarImporte, validarPeriodo } from '../utils/validation';
import { evaluarAlertasCuenta } from './alertas.service';

export async function listarCuentas(filtros: {
  search?: string;
  soloExcedidas?: boolean;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filtros.search) {
    params.push(`%${filtros.search.trim()}%`);
    conditions.push(
      `(vcs.numero_cuenta ILIKE $${params.length}
        OR COALESCE(c.razon_social, c.nombre_completo) ILIKE $${params.length}
        OR c.numero_documento ILIKE $${params.length})`
    );
  }
  if (filtros.soloExcedidas) {
    conditions.push('vcs.excede_linea = TRUE');
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
      vcs.*,
      c.tipo_persona,
      c.estado AS cliente_estado,
      COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
      c.numero_documento,
      td.codigo AS tipo_documento_codigo,
      s.nombre AS segmento_nombre,
      tm.codigo AS moneda_codigo,
      tm.simbolo AS moneda_simbolo
    FROM vw_cuenta_saldo vcs
    JOIN mae_cliente c ON c.id_cliente = vcs.id_cliente
    JOIN tipo_documento td ON td.id_tipo_documento = c.id_tipo_documento
    JOIN cat_segmento_cliente s ON s.id_segmento = c.id_segmento
    JOIN tipo_moneda tm ON tm.id_tipo_moneda = vcs.id_tipo_moneda
    ${whereClause}
    ORDER BY vcs.excede_linea DESC, vcs.id_cuenta ASC`,
    params
  );

  return result.rows;
}

export async function obtenerCuentaPorId(idCuenta: number) {
  const cuentaRes = await pool.query(
    `SELECT
      vcs.*,
      c.tipo_persona,
      c.estado AS cliente_estado,
      COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
      c.numero_documento,
      c.email AS cliente_email,
      c.telefono AS cliente_telefono,
      c.direccion AS cliente_direccion,
      td.codigo AS tipo_documento_codigo,
      s.nombre AS segmento_nombre,
      tm.codigo AS moneda_codigo,
      tm.nombre AS moneda_nombre,
      tm.simbolo AS moneda_simbolo
    FROM vw_cuenta_saldo vcs
    JOIN mae_cliente c ON c.id_cliente = vcs.id_cliente
    JOIN tipo_documento td ON td.id_tipo_documento = c.id_tipo_documento
    JOIN cat_segmento_cliente s ON s.id_segmento = c.id_segmento
    JOIN tipo_moneda tm ON tm.id_tipo_moneda = vcs.id_tipo_moneda
    WHERE vcs.id_cuenta = $1`,
    [idCuenta]
  );

  if (cuentaRes.rows.length === 0) {
    throw new AppError('Cuenta corriente no encontrada.', 404);
  }

  const [movimientosRes, alertasRes] = await Promise.all([
    pool.query(
      `WITH movs_con_saldo AS (
        SELECT
          v.*,
          u.nombre_completo AS usuario_registro,
          SUM(
            CASE
              WHEN v.estado_codigo = 'ANULADO' THEN 0
              WHEN v.naturaleza = 'C' THEN v.monto
              ELSE -v.monto
            END
          ) OVER (
            PARTITION BY v.id_cuenta
            ORDER BY v.fecha_movimiento ASC, v.id_movimiento ASC
          )::numeric(14,2) AS saldo_calculado
        FROM vw_movimiento_saldo v
        JOIN mae_usuario u ON u.id_usuario = v.id_usuario_registro
        WHERE v.id_cuenta = $1
      )
      SELECT *
      FROM movs_con_saldo
      ORDER BY fecha_movimiento DESC, id_movimiento DESC
      LIMIT 100`,
      [idCuenta]
    ),
    pool.query(
      `SELECT * FROM trs_alerta_credito
       WHERE id_cuenta = $1 AND estado IN ('ACTIVA', 'REVISADA')
       ORDER BY fecha_generacion DESC`,
      [idCuenta]
    ),
  ]);

  return {
    cuenta: cuentaRes.rows[0],
    movimientos: movimientosRes.rows,
    alertas: alertasRes.rows,
  };
}

export async function actualizarCuenta(
  idCuenta: number,
  input: { linea_credito?: number; estado?: 'ACTIVA' | 'SUSPENDIDA' | 'CERRADA' },
  idUsuario: number
) {
  return withTransaction(async (client) => {
    const prevRes = await client.query(
      'SELECT * FROM mae_cuenta_corriente WHERE id_cuenta = $1 FOR UPDATE',
      [idCuenta]
    );
    if (prevRes.rows.length === 0) {
      throw new AppError('Cuenta corriente no encontrada.', 404);
    }
    const prev = prevRes.rows[0];

    const nuevaLinea =
      input.linea_credito !== undefined
        ? validarImporte(input.linea_credito, {
            campo: 'La línea de crédito',
            permitirCero: true,
          })
        : null;

    const updatedRes = await client.query(
      `UPDATE mae_cuenta_corriente
       SET linea_credito = COALESCE($1, linea_credito),
           estado = COALESCE($2, estado),
           fecha_actualizacion = NOW()
       WHERE id_cuenta = $3
       RETURNING *`,
      [
        nuevaLinea,
        input.estado ?? null,
        idCuenta,
      ]
    );

    if (input.linea_credito !== undefined) {
      await evaluarAlertasCuenta(client, idCuenta, null, idUsuario);
    }

    await registrarAuditoria(client, {
      tablaAfectada: 'mae_cuenta_corriente',
      idRegistro: idCuenta,
      accion: 'UPDATE',
      datosAnteriores: prev,
      datosNuevos: updatedRes.rows[0],
      idUsuario,
    });

    return updatedRes.rows[0];
  });
}

/**
 * Genera el Estado de Cuenta por cuenta y período [fechaInicio, fechaFin]
 * usando la función SQL fn_resumen_periodo_cuenta y vw_movimiento_saldo.
 */
export async function obtenerEstadoCuenta(
  idCuenta: number,
  fechaInicio: string,
  fechaFin: string
) {
  if (!Number.isInteger(idCuenta) || idCuenta <= 0) {
    throw new AppError('Cuenta corriente inválida.', 400);
  }
  const { fechaInicio: ini, fechaFin: fin } = validarPeriodo(
    fechaInicio,
    fechaFin
  );

  const cuentaRes = await pool.query(
    `SELECT
      vcs.*,
      c.tipo_persona,
      c.estado AS cliente_estado,
      COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
      c.numero_documento,
      c.direccion,
      c.email,
      c.telefono,
      td.codigo AS tipo_documento_codigo,
      s.nombre AS segmento_nombre,
      tm.codigo AS moneda_codigo,
      tm.nombre AS moneda_nombre,
      tm.simbolo AS moneda_simbolo
    FROM vw_cuenta_saldo vcs
    JOIN mae_cliente c ON c.id_cliente = vcs.id_cliente
    JOIN tipo_documento td ON td.id_tipo_documento = c.id_tipo_documento
    JOIN cat_segmento_cliente s ON s.id_segmento = c.id_segmento
    JOIN tipo_moneda tm ON tm.id_tipo_moneda = vcs.id_tipo_moneda
    WHERE vcs.id_cuenta = $1`,
    [idCuenta]
  );

  if (cuentaRes.rows.length === 0) {
    throw new AppError('Cuenta corriente no encontrada.', 404);
  }

  const [resumenRes, movsRes] = await Promise.all([
    pool.query<{
      saldo_inicial: string;
      total_cargos: string;
      total_abonos: string;
      saldo_final: string;
    }>('SELECT * FROM fn_resumen_periodo_cuenta($1, $2::date, $3::date)', [
      idCuenta,
      ini,
      fin,
    ]),
    pool.query(
      `SELECT
        v.id_movimiento,
        v.fecha_movimiento,
        v.fecha_vencimiento,
        v.numero_documento_ref,
        v.glosa,
        v.monto,
        v.monto_aplicado,
        v.saldo_pendiente,
        v.tipo_codigo,
        v.tipo_nombre,
        v.naturaleza,
        v.estado_codigo,
        v.estado_nombre,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id_cargo', cargo.id_movimiento,
              'documento', cargo.numero_documento_ref,
              'monto', ap.monto_aplicado::text
            ) ORDER BY ap.id_aplicacion
          )
          FROM trs_aplicacion_pago ap
          JOIN trs_movimiento_cuenta cargo ON cargo.id_movimiento = ap.id_movimiento_cargo
                                         AND cargo.id_cuenta = v.id_cuenta
          WHERE ap.id_movimiento_abono = v.id_movimiento AND v.naturaleza = 'A'
        ), '[]'::jsonb) AS aplicaciones
      FROM vw_movimiento_saldo v
      WHERE v.id_cuenta = $1
        AND v.fecha_movimiento BETWEEN $2::date AND $3::date
        AND v.estado_codigo <> 'ANULADO'
      ORDER BY v.fecha_movimiento ASC, v.id_movimiento ASC`,
      [idCuenta, fechaInicio, fechaFin]
    ),
  ]);

  const resumenRow = resumenRes.rows[0];
  let saldoAcumulado = Number(resumenRow.saldo_inicial);

  const movimientos = movsRes.rows.map((mov) => {
    const monto = Number(mov.monto);
    if (mov.naturaleza === 'C') {
      saldoAcumulado = Number((saldoAcumulado + monto).toFixed(2));
    } else {
      saldoAcumulado = Number((saldoAcumulado - monto).toFixed(2));
    }

    return {
      ...mov,
      cargo: mov.naturaleza === 'C' ? monto : 0,
      abono: mov.naturaleza === 'A' ? monto : 0,
      saldo_acumulado: saldoAcumulado,
    };
  });

  return {
    cuenta: cuentaRes.rows[0],
    periodo: {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    },
    resumen: {
      saldo_inicial: Number(resumenRow.saldo_inicial),
      total_cargos: Number(resumenRow.total_cargos),
      total_abonos: Number(resumenRow.total_abonos),
      saldo_final: Number(resumenRow.saldo_final),
    },
    movimientos,
  };
}
