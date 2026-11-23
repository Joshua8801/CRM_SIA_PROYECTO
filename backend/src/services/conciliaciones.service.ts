import { pool, withTransaction } from '../config/db';
import { AppError } from '../types';
import { registrarAuditoria } from '../utils/audit';
import { obtenerEstadoCuenta } from './cuentas.service';

export interface PartidaDiscrepante {
  campo:
    | 'saldo_inicial'
    | 'total_cargos'
    | 'total_abonos'
    | 'saldo_final';
  etiqueta: string;
  sistema: number;
  manual: number;
  diferencia: number;
}

function toCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function compararImportesConciliacion(
  sistema: {
    saldo_inicial: number | string;
    total_cargos: number | string;
    total_abonos: number | string;
    saldo_final: number | string;
  },
  manual: {
    saldo_inicial: number | string;
    total_cargos: number | string;
    total_abonos: number | string;
    saldo_final: number | string;
  }
) {
  const partidas: Array<{
    campo: PartidaDiscrepante['campo'];
    etiqueta: string;
    sisCents: number;
    manCents: number;
  }> = [
    {
      campo: 'saldo_inicial',
      etiqueta: 'Saldo inicial',
      sisCents: toCents(sistema.saldo_inicial),
      manCents: toCents(manual.saldo_inicial),
    },
    {
      campo: 'total_cargos',
      etiqueta: 'Total cargos',
      sisCents: toCents(sistema.total_cargos),
      manCents: toCents(manual.total_cargos),
    },
    {
      campo: 'total_abonos',
      etiqueta: 'Total abonos',
      sisCents: toCents(sistema.total_abonos),
      manCents: toCents(manual.total_abonos),
    },
    {
      campo: 'saldo_final',
      etiqueta: 'Saldo final',
      sisCents: toCents(sistema.saldo_final),
      manCents: toCents(manual.saldo_final),
    },
  ];

  const diferencias = {
    diferencia_saldo_inicial: fromCents(
      partidas[0].sisCents - partidas[0].manCents
    ),
    diferencia_cargos: fromCents(partidas[1].sisCents - partidas[1].manCents),
    diferencia_abonos: fromCents(partidas[2].sisCents - partidas[2].manCents),
    diferencia_saldo: fromCents(partidas[3].sisCents - partidas[3].manCents),
  };

  const partidas_discrepantes: PartidaDiscrepante[] = partidas
    .filter((p) => p.sisCents !== p.manCents)
    .map((p) => ({
      campo: p.campo,
      etiqueta: p.etiqueta,
      sistema: fromCents(p.sisCents),
      manual: fromCents(p.manCents),
      diferencia: fromCents(p.sisCents - p.manCents),
    }));

  const estado: 'CONCILIADO' | 'CON_DIFERENCIA' =
    partidas_discrepantes.length === 0 ? 'CONCILIADO' : 'CON_DIFERENCIA';

  return {
    ...diferencias,
    partidas_discrepantes,
    estado,
  };
}

function enriquecerConciliacion<
  T extends {
    saldo_inicial_sistema: number | string;
    total_cargos_sistema: number | string;
    total_abonos_sistema: number | string;
    saldo_final_sistema: number | string;
    saldo_inicial_manual: number | string;
    total_cargos_manual: number | string;
    total_abonos_manual: number | string;
    saldo_final_manual: number | string;
  },
>(row: T) {
  const comp = compararImportesConciliacion(
    {
      saldo_inicial: row.saldo_inicial_sistema,
      total_cargos: row.total_cargos_sistema,
      total_abonos: row.total_abonos_sistema,
      saldo_final: row.saldo_final_sistema,
    },
    {
      saldo_inicial: row.saldo_inicial_manual,
      total_cargos: row.total_cargos_manual,
      total_abonos: row.total_abonos_manual,
      saldo_final: row.saldo_final_manual,
    }
  );

  return {
    ...row,
    diferencia_saldo_inicial: comp.diferencia_saldo_inicial,
    diferencia_cargos: comp.diferencia_cargos,
    diferencia_abonos: comp.diferencia_abonos,
    partidas_discrepantes: comp.partidas_discrepantes,
  };
}

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

  return result.rows.map(enriquecerConciliacion);
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

  const saldoIniCents = toCents(input.saldo_inicial_manual);
  const cargosCents = toCents(input.total_cargos_manual);
  const abonosCents = toCents(input.total_abonos_manual);
  const saldoFinCents = toCents(input.saldo_final_manual);

  if (
    !Number.isFinite(saldoIniCents) ||
    !Number.isFinite(cargosCents) ||
    !Number.isFinite(abonosCents) ||
    !Number.isFinite(saldoFinCents)
  ) {
    throw new AppError('Todos los importes manuales deben ser numéricos.', 400);
  }

  if (cargosCents < 0 || abonosCents < 0) {
    throw new AppError(
      'Los totales manuales de cargos y abonos no pueden ser negativos.',
      400
    );
  }

  const esperadoCents = saldoIniCents + cargosCents - abonosCents;
  if (saldoFinCents !== esperadoCents) {
    throw new AppError(
      `El saldo final manual (${fromCents(saldoFinCents).toFixed(2)}) debe ser igual a Saldo inicial + Cargos - Abonos (${fromCents(esperadoCents).toFixed(2)}).`,
      400
    );
  }

  const saldoIniManual = fromCents(saldoIniCents);
  const cargosManual = fromCents(cargosCents);
  const abonosManual = fromCents(abonosCents);
  const saldoFinManual = fromCents(saldoFinCents);

  const estadoCuenta = await obtenerEstadoCuenta(
    input.id_cuenta,
    input.fecha_inicio,
    input.fecha_fin
  );
  const sis = estadoCuenta.resumen;

  const comparacion = compararImportesConciliacion(sis, {
    saldo_inicial: saldoIniManual,
    total_cargos: cargosManual,
    total_abonos: abonosManual,
    saldo_final: saldoFinManual,
  });

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
        comparacion.estado,
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

    return enriquecerConciliacion(res.rows[0]);
  });
}
