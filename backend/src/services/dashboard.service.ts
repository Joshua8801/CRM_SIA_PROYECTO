import { pool } from '../config/db';

export interface SerieMonedaMensual {
  id_tipo_moneda: number;
  moneda_codigo: string;
  moneda_nombre: string;
  moneda_simbolo: string;
  meses: Array<{
    periodo: string;
    cargos: number;
    abonos: number;
  }>;
}

/**
 * Obtiene los totales mensuales de cargos y abonos de los últimos 6 meses
 * (incluido el mes actual), agrupados por moneda y excluyendo movimientos ANULADOS.
 * Cada abono se contabiliza una sola vez por su monto en trs_movimiento_cuenta,
 * sin duplicarse por aplicaciones de pago ni incluir promesas de pago.
 */
export async function obtenerCargosAbonosMensuales(): Promise<
  SerieMonedaMensual[]
> {
  const result = await pool.query<{
    periodo: string;
    id_tipo_moneda: number;
    moneda_codigo: string;
    moneda_nombre: string;
    moneda_simbolo: string;
    total_cargos: string;
    total_abonos: string;
  }>(`
    WITH meses AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
        date_trunc('month', CURRENT_DATE),
        INTERVAL '1 month'
      )::date AS mes_inicio
    ),
    monedas_activas AS (
      SELECT id_tipo_moneda, codigo, nombre, simbolo
      FROM tipo_moneda
      WHERE activo = TRUE
    ),
    totales AS (
      SELECT
        date_trunc('month', m.fecha_movimiento)::date AS mes_inicio,
        cc.id_tipo_moneda,
        COALESCE(SUM(CASE WHEN tmv.naturaleza = 'C' THEN m.monto ELSE 0 END), 0)::numeric(14,2) AS total_cargos,
        COALESCE(SUM(CASE WHEN tmv.naturaleza = 'A' THEN m.monto ELSE 0 END), 0)::numeric(14,2) AS total_abonos
      FROM trs_movimiento_cuenta m
      JOIN mae_cuenta_corriente cc ON cc.id_cuenta = m.id_cuenta
      JOIN tipo_movimiento_cuenta tmv ON tmv.id_tipo_movimiento = m.id_tipo_movimiento
      JOIN tipo_estado_movimiento est ON est.id_estado_movimiento = m.id_estado_movimiento
      WHERE est.codigo <> 'ANULADO'
        AND m.fecha_movimiento >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
        AND m.fecha_movimiento < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
      GROUP BY 1, 2
    )
    SELECT
      to_char(ms.mes_inicio, 'YYYY-MM') AS periodo,
      ma.id_tipo_moneda,
      ma.codigo AS moneda_codigo,
      ma.nombre AS moneda_nombre,
      ma.simbolo AS moneda_simbolo,
      COALESCE(t.total_cargos, 0)::numeric(14,2) AS total_cargos,
      COALESCE(t.total_abonos, 0)::numeric(14,2) AS total_abonos
    FROM meses ms
    CROSS JOIN monedas_activas ma
    LEFT JOIN totales t
      ON t.mes_inicio = ms.mes_inicio
     AND t.id_tipo_moneda = ma.id_tipo_moneda
    ORDER BY ma.id_tipo_moneda ASC, ms.mes_inicio ASC
  `);

  const porMoneda = new Map<number, SerieMonedaMensual>();

  for (const row of result.rows) {
    let serie = porMoneda.get(row.id_tipo_moneda);
    if (!serie) {
      serie = {
        id_tipo_moneda: row.id_tipo_moneda,
        moneda_codigo: row.moneda_codigo,
        moneda_nombre: row.moneda_nombre,
        moneda_simbolo: row.moneda_simbolo,
        meses: [],
      };
      porMoneda.set(row.id_tipo_moneda, serie);
    }
    serie.meses.push({
      periodo: row.periodo,
      cargos: Number(row.total_cargos),
      abonos: Number(row.total_abonos),
    });
  }

  return Array.from(porMoneda.values());
}

export async function obtenerResumenDashboardData() {
  const [
    kpisRes,
    kpisPorMonedaRes,
    alertasRes,
    seguimientosRes,
    segmentosRes,
    movimientosMensuales,
  ] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM mae_cliente WHERE estado = 'ACTIVO')::int AS clientes_activos,
        (SELECT COUNT(*) FROM mae_cuenta_corriente WHERE estado = 'ACTIVA')::int AS cuentas_activas,
        (SELECT COUNT(*) FROM trs_alerta_credito WHERE estado = 'ACTIVA')::int AS alertas_activas,
        (SELECT COUNT(*) FROM vw_cuenta_saldo WHERE excede_linea = TRUE AND estado = 'ACTIVA')::int AS cuentas_excedidas
    `),
    pool.query(`
      SELECT
        tm.id_tipo_moneda,
        tm.codigo AS moneda_codigo,
        tm.nombre AS moneda_nombre,
        tm.simbolo AS moneda_simbolo,
        COUNT(vcs.id_cuenta) FILTER (WHERE vcs.estado = 'ACTIVA')::int AS cuentas_activas,
        COALESCE(SUM(CASE WHEN vcs.saldo_actual > 0 THEN vcs.saldo_actual ELSE 0 END), 0)::numeric(14,2) AS cartera_por_cobrar,
        COALESCE(SUM(CASE WHEN vcs.estado = 'ACTIVA' THEN vcs.linea_credito ELSE 0 END), 0)::numeric(14,2) AS linea_credito_total,
        COUNT(vcs.id_cuenta) FILTER (WHERE vcs.excede_linea = TRUE AND vcs.estado = 'ACTIVA')::int AS cuentas_excedidas
      FROM tipo_moneda tm
      LEFT JOIN vw_cuenta_saldo vcs ON vcs.id_tipo_moneda = tm.id_tipo_moneda
      WHERE tm.activo = TRUE
      GROUP BY tm.id_tipo_moneda, tm.codigo, tm.nombre, tm.simbolo
      ORDER BY tm.id_tipo_moneda ASC
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
        tm.id_tipo_moneda,
        tm.codigo AS moneda_codigo,
        tm.simbolo AS moneda_simbolo,
        COUNT(DISTINCT c.id_cliente)::int AS cantidad_clientes,
        COALESCE(SUM(vcs.saldo_actual), 0)::numeric(14,2) AS saldo_total
      FROM cat_segmento_cliente s
      CROSS JOIN tipo_moneda tm
      LEFT JOIN mae_cliente c ON c.id_segmento = s.id_segmento AND c.estado <> 'INACTIVO'
      LEFT JOIN vw_cuenta_saldo vcs ON vcs.id_cliente = c.id_cliente AND vcs.id_tipo_moneda = tm.id_tipo_moneda
      WHERE tm.activo = TRUE
      GROUP BY s.id_segmento, s.nombre, tm.id_tipo_moneda, tm.codigo, tm.simbolo
      ORDER BY tm.id_tipo_moneda ASC, s.id_segmento ASC
    `),
    obtenerCargosAbonosMensuales(),
  ]);

  return {
    kpis: kpisRes.rows[0],
    kpisPorMoneda: kpisPorMonedaRes.rows,
    alertasRecientes: alertasRes.rows,
    proximosSeguimientos: seguimientosRes.rows,
    resumenSegmentos: segmentosRes.rows,
    movimientosMensuales,
  };
}
