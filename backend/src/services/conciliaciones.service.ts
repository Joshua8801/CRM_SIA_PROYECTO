import { pool, withTransaction } from '../config/db';
import { AppError } from '../types';
import { registrarAuditoria } from '../utils/audit';
import { obtenerEstadoCuenta } from './cuentas.service';

export async function listarConciliaciones(idCuenta?: number) {
  const params: unknown[] = [];
  let whereClause = '';
  if (idCuenta) {
    params.push(idCuenta);
    whereClause = 'WHERE co.id_cuenta = $1';
  }

  const result = await pool.query(
    `SELECT
      co.*,
      cc.numero_cuenta,
      c.id_cliente,
      COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
      tm.codigo AS moneda_codigo,
      tm.simbolo AS moneda_simbolo,
      u.nombre_completo AS usuario_concilia
    FROM trs_conciliacion_cuenta co
    JOIN mae_cuenta_corriente cc ON cc.id_cuenta = co.id_cuenta
    JOIN mae_cliente c ON c.id_cliente = cc.id_cliente
    JOIN tipo_moneda tm ON tm.id_tipo_moneda = cc.id_tipo_moneda
    JOIN mae_usuario u ON u.id_usuario = co.id_usuario_concilia
    ${whereClause}
    ORDER BY co.fecha_conciliacion DESC`,
    params
  );

  return result.rows;
}

export async function previsualizarConciliacion(
  idCuenta: number,
  fechaInicio: string,
  fechaFin: string
) {
  const estadoCuenta = await obtenerEstadoCuenta(
    idCuenta,
    fechaInicio,
    fechaFin
  );

  return {
    cuenta: estadoCuenta.cuenta,
    periodo: estadoCuenta.periodo,
    sistema: {
      saldo_inicial_sistema: estadoCuenta.resumen.saldo_inicial,
      total_cargos_sistema: estadoCuenta.resumen.total_cargos,
      total_abonos_sistema: estadoCuenta.resumen.total_abonos,
      saldo_final_sistema: estadoCuenta.resumen.saldo_final,
      cantidad_movimientos: estadoCuenta.movimientos.length,
    },
  };
}

export async function registrarConciliacion(
  input: {
    id_cuenta: number;
    fecha_inicio: string;
    fecha_fin: string;
    saldo_inicial_manual: number;
    total_cargos_manual: number;
    total_abonos_manual: number;
    saldo_final_manual: number;
    observaciones?: string | null;
  },
  idUsuario: number
) {
  if (input.fecha_fin < input.fecha_inicio) {
    throw new AppError(
      'La fecha fin no puede ser menor que la fecha inicio.',
      400
    );
  }

  const saldoIniManual = Number(Number(input.saldo_inicial_manual).toFixed(2));
  const cargosManual = Number(Number(input.total_cargos_manual).toFixed(2));
  const abonosManual = Number(Number(input.total_abonos_manual).toFixed(2));
  const saldoFinManual = Number(Number(input.saldo_final_manual).toFixed(2));

  if (cargosManual < 0 || abonosManual < 0) {
    throw new AppError(
      'Los totales manuales de cargos y abonos no pueden ser negativos.',
      400
    );
  }

  const esperadoManual = Number(
    (saldoIniManual + cargosManual - abonosManual).toFixed(2)
  );
  if (Math.abs(saldoFinManual - esperadoManual) >= 0.01) {
    throw new AppError(
      `El saldo final manual (${saldoFinManual.toFixed(2)}) debe ser igual a Saldo inicial + Cargos - Abonos (${esperadoManual.toFixed(2)}).`,
      400
    );
  }

  const estadoCuenta = await obtenerEstadoCuenta(
    input.id_cuenta,
    input.fecha_inicio,
    input.fecha_fin
  );
  const sis = estadoCuenta.resumen;

  const diferencia = Number((sis.saldo_final - saldoFinManual).toFixed(2));
  const estado = Math.abs(diferencia) < 0.01 ? 'CONCILIADO' : 'CON_DIFERENCIA';

  return withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO trs_conciliacion_cuenta
        (id_cuenta, fecha_inicio, fecha_fin,
         saldo_inicial_sistema, total_cargos_sistema, total_abonos_sistema, saldo_final_sistema,
         saldo_inicial_manual, total_cargos_manual, total_abonos_manual, saldo_final_manual,
         estado, observaciones, id_usuario_concilia)
       VALUES ($1, $2::date, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        input.id_cuenta,
        input.fecha_inicio,
        input.fecha_fin,
        sis.saldo_inicial,
        sis.total_cargos,
        sis.total_abonos,
        sis.saldo_final,
        saldoIniManual,
        cargosManual,
        abonosManual,
        saldoFinManual,
        estado,
        input.observaciones?.trim() || null,
        idUsuario,
      ]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_conciliacion_cuenta',
      idRegistro: res.rows[0].id_conciliacion,
      accion: 'INSERT',
      datosNuevos: res.rows[0],
      idUsuario,
    });

    return res.rows[0];
  });
}
