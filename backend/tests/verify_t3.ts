import assert from 'node:assert/strict';
import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../src/config/db';
import {
  abrirCuentaCliente,
  crearCliente,
} from '../src/services/clientes.service';
import { obtenerCuentaPorId, obtenerEstadoCuenta } from '../src/services/cuentas.service';
import { aplicarPago, anularMovimiento, registrarMovimiento } from '../src/services/movimientos.service';
import { actualizarEstadoAlerta } from '../src/services/alertas.service';
import { registrarConciliacion } from '../src/services/conciliaciones.service';
import {
  abrirGestion,
  crearCompromisoPago,
  obtenerGestionPorId,
  vincularAbonoACompromiso,
} from '../src/services/cobranza.service';
import {
  obtenerCargosAbonosMensuales,
  obtenerResumenDashboardData,
} from '../src/services/dashboard.service';

async function run() {
  console.log('=== Verificación Funcional CRM Cuentas Corrientes T3 ===');
  const sufijo = String(Date.now()).slice(-6);
  const idUsuario = 1;

  // 1. Registro de persona natural
  const cliNatural = await crearCliente(
    {
      tipo_persona: 'NATURAL',
      id_tipo_documento: 2, // DNI
      numero_documento: `99${sufijo}`,
      nombre_completo: `Juan Pérez Prueba ${sufijo}`,
      id_segmento: 3, // Minorista
      linea_credito: 1000,
    },
    idUsuario
  );
  assert.equal(cliNatural.tipo_persona, 'NATURAL');
  assert.ok(cliNatural.nombre_completo);
  assert.equal(cliNatural.razon_social, null);
  console.log('✓ 1. Registro de persona natural OK');

  // 2. Registro de persona jurídica + 3. Creación automática de cuenta corriente
  const cliJuridica = await crearCliente(
    {
      tipo_persona: 'JURIDICA',
      id_tipo_documento: 1, // RUC
      numero_documento: `20999${sufijo}`,
      razon_social: `Empresa Test ${sufijo} S.A.C.`,
      id_segmento: 2, // PYME
      linea_credito: 1000,
    },
    idUsuario
  );
  assert.equal(cliJuridica.tipo_persona, 'JURIDICA');
  assert.ok(cliJuridica.razon_social);
  assert.equal(cliJuridica.nombre_completo, null);
  assert.ok(cliJuridica.cuenta_inicial?.id_cuenta);
  const idCuenta = cliJuridica.cuenta_inicial.id_cuenta as number;
  console.log('✓ 2. Registro de persona jurídica OK');
  console.log('✓ 3. Creación de cuenta corriente OK');

  const hoy = new Date().toISOString().slice(0, 10);

  // 4. Registro de cargo (850 -> 85% de 1000 -> debe generar PROXIMO_LIMITE)
  const cargo1 = await registrarMovimiento(
    {
      id_cuenta: idCuenta,
      id_tipo_movimiento: 1, // CARGO_FACTURA
      numero_documento_ref: `F-TEST-${sufijo}`,
      fecha_movimiento: hoy,
      fecha_vencimiento: hoy,
      monto: 850,
      glosa: 'Cargo de prueba 1',
    },
    idUsuario
  );
  assert.ok(cargo1.id_movimiento);
  console.log('✓ 4. Registro de cargo OK');

  // 9. Generación de alerta por proximidad al límite (85%)
  const alertaProx = await pool.query(
    `SELECT * FROM trs_alerta_credito
     WHERE id_cuenta = $1 AND tipo_alerta = 'PROXIMO_LIMITE' AND estado = 'ACTIVA'`,
    [idCuenta]
  );
  assert.equal(alertaProx.rows.length, 1);
  console.log('✓ 9. Alerta por proximidad al límite (85%) OK');

  // Cargo adicional de 300 -> saldo 1150 (> 1000 -> EXCESO_LINEA)
  await registrarMovimiento(
    {
      id_cuenta: idCuenta,
      id_tipo_movimiento: 1,
      numero_documento_ref: `F-TEST2-${sufijo}`,
      fecha_movimiento: hoy,
      fecha_vencimiento: hoy,
      monto: 300,
      glosa: 'Cargo de prueba 2 (exceso)',
    },
    idUsuario
  );

  // 10. Generación de alerta por exceso de crédito
  const alertaExceso = await pool.query(
    `SELECT * FROM trs_alerta_credito
     WHERE id_cuenta = $1 AND tipo_alerta = 'EXCESO_LINEA' AND estado = 'ACTIVA'`,
    [idCuenta]
  );
  assert.equal(alertaExceso.rows.length, 1);
  assert.equal(Number(alertaExceso.rows[0].monto_excedido), 150);
  console.log('✓ 10. Alerta por exceso de crédito OK');

  // 5. Registro de abono (500 -> saldo baja a 650)
  const abono1 = await registrarMovimiento(
    {
      id_cuenta: idCuenta,
      id_tipo_movimiento: 3, // ABONO_PAGO
      numero_documento_ref: `OP-TEST-${sufijo}`,
      fecha_movimiento: hoy,
      monto: 500,
      glosa: 'Abono de prueba',
    },
    idUsuario
  );
  assert.ok(abono1.id_movimiento);
  console.log('✓ 5. Registro de abono OK');

  // 6. Aplicación parcial de pago (aplicar 400 de 500 al cargo1 de 850)
  await aplicarPago(abono1.id_movimiento, cargo1.id_movimiento, 400, idUsuario);
  const cargo1Vista = await pool.query<{ saldo_pendiente: string }>(
    'SELECT saldo_pendiente FROM vw_movimiento_saldo WHERE id_movimiento = $1',
    [cargo1.id_movimiento]
  );
  assert.equal(Number(cargo1Vista.rows[0].saldo_pendiente), 450);
  console.log('✓ 6. Aplicación parcial de pago OK');

  // 7. Rechazo de aplicación superior al saldo disponible (quedan 100 en abono1, intentamos aplicar 200)
  await assert.rejects(
    () => aplicarPago(abono1.id_movimiento, cargo1.id_movimiento, 200, idUsuario),
    /supera el saldo disponible del abono/i
  );
  console.log('✓ 7. Rechazo de aplicación superior al saldo disponible OK');

  // 8. Cálculo correcto del saldo (850 + 300 - 500 = 650)
  const detalle = await obtenerCuentaPorId(idCuenta);
  assert.equal(Number(detalle.cuenta.saldo_actual), 650);
  console.log('✓ 8. Cálculo correcto del saldo OK');

  // 11. Estado de cuenta por período
  const estado = await obtenerEstadoCuenta(idCuenta, hoy, hoy);
  assert.equal(estado.resumen.total_cargos, 1150);
  assert.equal(estado.resumen.total_abonos, 500);
  assert.equal(estado.resumen.saldo_final, 650);
  console.log('✓ 11. Estado de cuenta por período OK');

  // 12. Conciliación correcta
  const concOk = await registrarConciliacion(
    {
      id_cuenta: idCuenta,
      fecha_inicio: hoy,
      fecha_fin: hoy,
      saldo_inicial_manual: 0,
      total_cargos_manual: 1150,
      total_abonos_manual: 500,
      saldo_final_manual: 650,
      observaciones: 'Conciliación exacta',
    },
    idUsuario
  );
  assert.equal(concOk.estado, 'CONCILIADO');
  assert.equal(Number(concOk.diferencia_saldo), 0);
  console.log('✓ 12. Conciliación correcta OK');

  // 13. Conciliación con diferencias
  const concDif = await registrarConciliacion(
    {
      id_cuenta: idCuenta,
      fecha_inicio: hoy,
      fecha_fin: hoy,
      saldo_inicial_manual: 0,
      total_cargos_manual: 1000,
      total_abonos_manual: 500,
      saldo_final_manual: 500,
      observaciones: 'Diferencia detectada en prueba',
    },
    idUsuario
  );
  assert.equal(concDif.estado, 'CON_DIFERENCIA');
  assert.equal(Number(concDif.diferencia_saldo), 150);
  console.log('✓ 13. Conciliación con diferencias OK');

  // 14. Casos específicos de conciliación (4 importes + diferencia compensada + fórmula inconsistente)
  const cliConc = await crearCliente(
    {
      tipo_persona: 'JURIDICA',
      id_tipo_documento: 1,
      numero_documento: `20888${sufijo}`,
      razon_social: `Empresa Concil ${sufijo} S.A.C.`,
      id_segmento: 2,
      linea_credito: 20000,
    },
    idUsuario
  );
  const idCuentaConc = cliConc.cuenta_inicial.id_cuenta as number;
  const ayerDate = new Date();
  ayerDate.setDate(ayerDate.getDate() - 1);
  const ayer = ayerDate.toISOString().slice(0, 10);

  // Saldo inicial = 4500 (movimiento de ayer), cargos del período = 1380, abonos = 3600 => saldo final = 2280
  await registrarMovimiento(
    {
      id_cuenta: idCuentaConc,
      id_tipo_movimiento: 1,
      fecha_movimiento: ayer,
      fecha_vencimiento: ayer,
      numero_documento_ref: 'F-APERTURA',
      monto: 4500,
      glosa: 'Saldo inicial período',
    },
    idUsuario
  );
  await registrarMovimiento(
    {
      id_cuenta: idCuentaConc,
      id_tipo_movimiento: 1,
      fecha_movimiento: hoy,
      fecha_vencimiento: hoy,
      numero_documento_ref: 'F-PERIODO',
      monto: 1380,
      glosa: 'Cargos período',
    },
    idUsuario
  );
  await registrarMovimiento(
    {
      id_cuenta: idCuentaConc,
      id_tipo_movimiento: 3,
      fecha_movimiento: hoy,
      monto: 3600,
      glosa: 'Abonos período',
    },
    idUsuario
  );

  // Caso 1: 4 importes coinciden (4500, 1380, 3600, 2280) => CONCILIADO
  const caso1 = await registrarConciliacion(
    {
      id_cuenta: idCuentaConc,
      fecha_inicio: hoy,
      fecha_fin: hoy,
      saldo_inicial_manual: 4500,
      total_cargos_manual: 1380,
      total_abonos_manual: 3600,
      saldo_final_manual: 2280,
    },
    idUsuario
  );
  assert.equal(caso1.estado, 'CONCILIADO');
  assert.equal(Number(caso1.diferencia_saldo), 0);
  assert.equal(caso1.partidas_discrepantes.length, 0);
  console.log('✓ 14a. Conciliación 4 importes exactos (4500/1380/3600/2280) => CONCILIADO OK');

  // Caso 2: Diferencia compensada (cargos 1480, abonos 3700, saldo final 2280) => CON_DIFERENCIA con 2 partidas
  const caso2 = await registrarConciliacion(
    {
      id_cuenta: idCuentaConc,
      fecha_inicio: hoy,
      fecha_fin: hoy,
      saldo_inicial_manual: 4500,
      total_cargos_manual: 1480,
      total_abonos_manual: 3700,
      saldo_final_manual: 2280,
    },
    idUsuario
  );
  assert.equal(caso2.estado, 'CON_DIFERENCIA');
  assert.equal(Number(caso2.diferencia_saldo), 0);
  assert.equal(caso2.partidas_discrepantes.length, 2);
  assert.deepEqual(
    caso2.partidas_discrepantes.map((p: { campo: string }) => p.campo),
    ['total_cargos', 'total_abonos']
  );
  console.log('✓ 14b. Conciliación con diferencia compensada (dif_saldo=0) => CON_DIFERENCIA (2 partidas) OK');

  // Caso 3: Saldo final manual inconsistente con su propia fórmula => rechazo
  await assert.rejects(
    () =>
      registrarConciliacion(
        {
          id_cuenta: idCuentaConc,
          fecha_inicio: hoy,
          fecha_fin: hoy,
          saldo_inicial_manual: 4500,
          total_cargos_manual: 1380,
          total_abonos_manual: 3600,
          saldo_final_manual: 2500,
        },
        idUsuario
      ),
    /debe ser igual a Saldo inicial \+ Cargos - Abonos/i
  );
  console.log('✓ 14c. Rechazo de saldo final manual inconsistente OK');

  const alertaCliente = await crearCliente({
    tipo_persona: 'JURIDICA',
    id_tipo_documento: 1,
    numero_documento: `20777${sufijo}`,
    razon_social: `Empresa alerta ${sufijo}`,
    id_segmento: 2,
    linea_credito: 15000,
  }, idUsuario);
  const cuentaAlerta = alertaCliente.cuenta_inicial.id_cuenta;
  const factura = {
    id_cuenta: cuentaAlerta,
    id_tipo_movimiento: 1,
    numero_documento_ref: 'F001-016800',
    fecha_movimiento: hoy,
    fecha_vencimiento: hoy,
    monto: 16800,
    glosa: 'Factura de prueba',
  };

  await assert.rejects(
    () => registrarMovimiento({ ...factura, fecha_vencimiento: null }, idUsuario),
    /vencimiento es obligatoria/
  );
  await assert.rejects(
    () => registrarMovimiento({ ...factura, fecha_vencimiento: ayer }, idUsuario),
    /anterior a la fecha/
  );
  await assert.rejects(
    () => registrarMovimiento({ ...factura, fecha_vencimiento: '2026-02-30' }, idUsuario),
    /vencimiento no es válida/
  );

  const registros = await Promise.allSettled([
    registrarMovimiento(factura, idUsuario),
    registrarMovimiento({ ...factura, numero_documento_ref: ' f001 - 016800 ' }, idUsuario),
  ]);
  assert.equal(registros.filter((resultado) => resultado.status === 'fulfilled').length, 1);
  const duplicado = registros.find((resultado) => resultado.status === 'rejected');
  assert.equal(duplicado?.reason.statusCode, 409);
  let detalleAlerta = await obtenerCuentaPorId(cuentaAlerta);
  assert.equal(Number(detalleAlerta.cuenta.saldo_actual), 16800);
  const alertaRevisada = detalleAlerta.alertas.find((alerta) => alerta.tipo_alerta === 'EXCESO_LINEA');
  assert.ok(alertaRevisada);
  await actualizarEstadoAlerta(alertaRevisada.id_alerta, 'REVISADA', idUsuario);

  const registrarAbono = (monto: number) => registrarMovimiento({
    id_cuenta: cuentaAlerta,
    id_tipo_movimiento: 3,
    fecha_movimiento: hoy,
    monto,
    glosa: 'Abono de prueba',
  }, idUsuario);
  const abono = await registrarAbono(2000);
  await anularMovimiento(abono.id_movimiento, idUsuario);
  detalleAlerta = await obtenerCuentaPorId(cuentaAlerta);
  const nuevosExcesos = detalleAlerta.alertas.filter((alerta) => alerta.tipo_alerta === 'EXCESO_LINEA');
  assert.equal(nuevosExcesos.length, 1);
  const nuevoExceso = nuevosExcesos[0];
  await actualizarEstadoAlerta(nuevoExceso.id_alerta, 'REVISADA', idUsuario);
  const primerAbono = await registrarAbono(100);
  detalleAlerta = await obtenerCuentaPorId(cuentaAlerta);
  assert.deepEqual(
    detalleAlerta.alertas.filter((a) => a.tipo_alerta === 'EXCESO_LINEA')
      .map((a) => [a.id_alerta, a.estado, Number(a.monto_excedido)]),
    [[nuevoExceso.id_alerta, 'REVISADA', 1700]]
  );
  await anularMovimiento(primerAbono.id_movimiento, idUsuario);
  await registrarAbono(2000);
  detalleAlerta = await obtenerCuentaPorId(cuentaAlerta);
  assert.equal(Number(detalleAlerta.cuenta.saldo_actual), 14800);
  assert.deepEqual(detalleAlerta.alertas.map((a) => a.tipo_alerta), ['PROXIMO_LIMITE']);
  assert.deepEqual(
    (await pool.query('SELECT estado FROM trs_alerta_credito WHERE id_alerta = ANY($1)', [
      [alertaRevisada.id_alerta, nuevoExceso.id_alerta],
    ])).rows.map((a) => a.estado),
    ['RESUELTA', 'RESUELTA']
  );

  const anulable = await registrarMovimiento({ ...factura, numero_documento_ref: 'F-REUTILIZABLE', monto: 200 }, idUsuario);
  await anularMovimiento(anulable.id_movimiento, idUsuario);
  const cargo2 = await registrarMovimiento({ ...factura, numero_documento_ref: 'f-reutilizable', monto: 200 }, idUsuario);
  const cargoPrincipal = detalleAlerta.movimientos.find((m) => m.naturaleza === 'C');
  assert.ok(cargoPrincipal);
  const pagoDistribuido = await registrarAbono(300);
  await aplicarPago(pagoDistribuido.id_movimiento, cargoPrincipal.id_movimiento, 200, idUsuario);
  await aplicarPago(pagoDistribuido.id_movimiento, cargo2.id_movimiento, 100, idUsuario);
  const estadoDistribuido = await obtenerEstadoCuenta(cuentaAlerta, hoy, hoy);
  assert.equal(estadoDistribuido.resumen.total_abonos, 2300);
  const filasPago = estadoDistribuido.movimientos.filter((m) => m.id_movimiento === pagoDistribuido.id_movimiento);
  assert.equal(filasPago.length, 1);
  assert.equal(filasPago[0].abono, 300);
  assert.deepEqual(filasPago[0].aplicaciones.map((a: { monto: string }) => a.monto), ['200.00', '100.00']);
  console.log('✓ 15–17. Vencimientos, concurrencia, alertas y pago distribuido OK');

  // 18. Gestión de cobranza y compromisos de pago
  const cliCob = await crearCliente(
    {
      tipo_persona: 'NATURAL',
      id_tipo_documento: 2,
      numero_documento: `88${sufijo}`,
      nombre_completo: `Cliente Cobranza ${sufijo}`,
      id_segmento: 3,
      linea_credito: 1000,
    },
    idUsuario
  );
  const idCuentaCob = cliCob.cuenta_inicial.id_cuenta as number;

  // Cuenta debe S/ 500.00
  await registrarMovimiento(
    {
      id_cuenta: idCuentaCob,
      id_tipo_movimiento: 1,
      numero_documento_ref: `F-COB-${sufijo}`,
      fecha_movimiento: hoy,
      fecha_vencimiento: hoy,
      monto: 500,
      glosa: 'Factura deuda inicial 500',
    },
    idUsuario
  );

  const gestion = await abrirGestion(
    { id_cuenta: idCuentaCob, motivo: 'Seguimiento deuda S/ 500.00' },
    idUsuario
  );
  const comp200 = await crearCompromisoPago(
    gestion.id_gestion,
    {
      fecha_pactada: hoy,
      monto_comprometido: 200,
      observacion: 'Promesa de pago S/ 200.00',
    },
    idUsuario
  );
  // Registrar compromiso conserva saldo en S/ 500.00
  let ctaCob = await obtenerCuentaPorId(idCuentaCob);
  assert.equal(Number(ctaCob.cuenta.saldo_actual), 500);
  console.log('✓ 18a. Compromiso S/ 200.00 conserva saldo en S/ 500.00 OK');

  // Rechazo de abono de otra cuenta
  await assert.rejects(
    () => vincularAbonoACompromiso(comp200.id_compromiso, abono1.id_movimiento, idUsuario),
    /pertenece a otra cuenta corriente/i
  );
  console.log('✓ 18b. Rechazo de abono de otra cuenta OK');

  // Abono válido de S/ 200.00 => saldo S/ 300.00 y compromiso CUMPLIDO
  const abono200 = await registrarMovimiento(
    {
      id_cuenta: idCuentaCob,
      id_tipo_movimiento: 3,
      numero_documento_ref: `OP-COB-${sufijo}`,
      fecha_movimiento: hoy,
      monto: 200,
      glosa: 'Abono cumplimiento compromiso',
    },
    idUsuario
  );
  const compCumplido = await vincularAbonoACompromiso(
    comp200.id_compromiso,
    abono200.id_movimiento,
    idUsuario
  );
  assert.equal(compCumplido.estado, 'CUMPLIDO');
  ctaCob = await obtenerCuentaPorId(idCuentaCob);
  assert.equal(Number(ctaCob.cuenta.saldo_actual), 300);
  console.log('✓ 18c. Abono S/ 200.00 => saldo S/ 300.00 y compromiso CUMPLIDO OK');

  // Anular abono vinculado => saldo vuelve a S/ 500.00 y compromiso vuelve a PENDIENTE
  await anularMovimiento(abono200.id_movimiento, idUsuario);
  ctaCob = await obtenerCuentaPorId(idCuentaCob);
  assert.equal(Number(ctaCob.cuenta.saldo_actual), 500);
  const detCob = await obtenerGestionPorId(gestion.id_gestion);
  const compPostAnul = detCob.compromisos.find(
    (c: { id_compromiso: number }) => c.id_compromiso === comp200.id_compromiso
  );
  assert.equal(compPostAnul.estado_efectivo, 'PENDIENTE');
  assert.equal(compPostAnul.id_movimiento_abono, null);
  console.log('✓ 18d. Anulación de abono vinculado revierte compromiso y saldo OK');

  // Compromiso vencido sin pago => estado_efectivo INCUMPLIDO
  const haceDosDiasDate = new Date();
  haceDosDiasDate.setDate(haceDosDiasDate.getDate() - 2);
  const fechaVencida = haceDosDiasDate.toISOString().slice(0, 10);
  const compVencido = await crearCompromisoPago(
    gestion.id_gestion,
    {
      fecha_pactada: fechaVencida,
      monto_comprometido: 100,
      observacion: 'Compromiso vencido de prueba',
    },
    idUsuario
  );
  const detCobVenc = await obtenerGestionPorId(gestion.id_gestion);
  const compVencRow = detCobVenc.compromisos.find(
    (c: { id_compromiso: number }) => c.id_compromiso === compVencido.id_compromiso
  );
  assert.equal(compVencRow.estado_efectivo, 'INCUMPLIDO');
  console.log('✓ 18e. Compromiso vencido sin pago se muestra INCUMPLIDO OK');

  // 19. Gráfica de cargos y abonos mensuales (6 meses, 2+ meses verificados contra PostgreSQL,
  //     excluye anulados y promesas de pago, cuenta abono distribuido una sola vez)
  const haceUnMesDate = new Date();
  haceUnMesDate.setMonth(haceUnMesDate.getMonth() - 1);
  const fechaMesAnt = haceUnMesDate.toISOString().slice(0, 10);
  const periodoActual = hoy.slice(0, 7);
  const periodoAnterior = fechaMesAnt.slice(0, 7);

  // Registrar movimiento en el mes anterior + uno anulado en el mes anterior para verificar exclusión
  await registrarMovimiento(
    {
      id_cuenta: idCuentaCob,
      id_tipo_movimiento: 1,
      numero_documento_ref: `F-MESANT-${sufijo}`,
      fecha_movimiento: fechaMesAnt,
      fecha_vencimiento: fechaMesAnt,
      monto: 120,
      glosa: 'Cargo mes anterior para gráfica',
    },
    idUsuario
  );
  const movAnuladoMesAnt = await registrarMovimiento(
    {
      id_cuenta: idCuentaCob,
      id_tipo_movimiento: 1,
      numero_documento_ref: `F-ANUL-G-${sufijo}`,
      fecha_movimiento: fechaMesAnt,
      fecha_vencimiento: fechaMesAnt,
      monto: 999,
      glosa: 'Cargo anulado mes anterior (excluido)',
    },
    idUsuario
  );
  await anularMovimiento(movAnuladoMesAnt.id_movimiento, idUsuario);

  const seriesMensuales = await obtenerCargosAbonosMensuales();
  const seriePen = seriesMensuales.find((s) => s.moneda_codigo === 'PEN');
  assert.ok(seriePen);
  assert.equal(seriePen.meses.length, 6);

  // Comparar mes actual y mes anterior directamente contra SQL en PostgreSQL
  const pgCheck = await pool.query<{
    periodo: string;
    cargos: string;
    abonos: string;
  }>(
    `SELECT
      to_char(date_trunc('month', m.fecha_movimiento), 'YYYY-MM') AS periodo,
      COALESCE(SUM(CASE WHEN tmv.naturaleza = 'C' THEN m.monto ELSE 0 END), 0)::numeric(14,2) AS cargos,
      COALESCE(SUM(CASE WHEN tmv.naturaleza = 'A' THEN m.monto ELSE 0 END), 0)::numeric(14,2) AS abonos
    FROM trs_movimiento_cuenta m
    JOIN mae_cuenta_corriente cc ON cc.id_cuenta = m.id_cuenta
    JOIN tipo_movimiento_cuenta tmv ON tmv.id_tipo_movimiento = m.id_tipo_movimiento
    JOIN tipo_estado_movimiento est ON est.id_estado_movimiento = m.id_estado_movimiento
    WHERE cc.id_tipo_moneda = $1
      AND est.codigo <> 'ANULADO'
      AND to_char(date_trunc('month', m.fecha_movimiento), 'YYYY-MM') = ANY($2::text[])
    GROUP BY 1`,
    [seriePen.id_tipo_moneda, [periodoAnterior, periodoActual]]
  );

  for (const p of [periodoAnterior, periodoActual]) {
    const apiMes: { periodo: string; cargos: number; abonos: number } | undefined =
      seriePen.meses.find((m) => m.periodo === p);
    const dbMes = pgCheck.rows.find((r) => r.periodo === p);
    assert.ok(apiMes, `Falta período ${p} en respuesta API`);
    assert.equal(apiMes.cargos, Number(dbMes?.cargos || 0));
    assert.equal(apiMes.abonos, Number(dbMes?.abonos || 0));
  }
  console.log('✓ 19. Cargos y abonos mensuales (6 meses, 2 meses vs PostgreSQL, sin anulados/promesas/duplicados) OK');

  // 20. Multimoneda PEN y USD (abrir cuenta USD, rechazar duplicada, movimientos USD=100-30=70, conservar PEN)
  const dashAntes = await obtenerResumenDashboardData();
  const penKpiAntes = dashAntes.kpisPorMoneda.find(
    (k: { moneda_codigo: string }) => k.moneda_codigo === 'PEN'
  );
  const penSerieAntes = dashAntes.movimientosMensuales.find(
    (s) => s.moneda_codigo === 'PEN'
  );
  const penMesAntes = penSerieAntes?.meses.find((m) => m.periodo === periodoActual);

  const cuentaUsd = await abrirCuentaCliente(
    cliNatural.id_cliente,
    { id_tipo_moneda: 2, linea_credito: 500 },
    idUsuario
  );
  assert.equal(cuentaUsd.moneda_codigo, 'USD');

  // Rechazar segunda cuenta USD para el mismo cliente
  await assert.rejects(
    () =>
      abrirCuentaCliente(
        cliNatural.id_cliente,
        { id_tipo_moneda: 2, linea_credito: 500 },
        idUsuario
      ),
    /ya tiene una cuenta corriente en USD/i
  );

  // Cargo USD 100 y Abono USD 30 en el mes actual => saldo USD = 70
  await registrarMovimiento(
    {
      id_cuenta: cuentaUsd.id_cuenta,
      id_tipo_movimiento: 1,
      numero_documento_ref: `F-USD-${sufijo}`,
      fecha_movimiento: hoy,
      fecha_vencimiento: hoy,
      monto: 100,
      glosa: 'Cargo USD prueba',
    },
    idUsuario
  );
  await registrarMovimiento(
    {
      id_cuenta: cuentaUsd.id_cuenta,
      id_tipo_movimiento: 3,
      numero_documento_ref: `OP-USD-${sufijo}`,
      fecha_movimiento: hoy,
      monto: 30,
      glosa: 'Abono USD prueba',
    },
    idUsuario
  );

  const detUsd = await obtenerCuentaPorId(cuentaUsd.id_cuenta);
  assert.equal(Number(detUsd.cuenta.saldo_actual), 70);

  const dashDespues = await obtenerResumenDashboardData();
  const usdSerie = dashDespues.movimientosMensuales.find(
    (s) => s.moneda_codigo === 'USD'
  );
  const usdMes: { periodo: string; cargos: number; abonos: number } | undefined =
    usdSerie?.meses.find((m) => m.periodo === periodoActual);
  assert.ok(usdMes);
  assert.equal(usdMes.cargos, 100);
  assert.equal(usdMes.abonos, 30);

  // Totales PEN conservados intactos
  const penKpiDespues = dashDespues.kpisPorMoneda.find(
    (k: { moneda_codigo: string }) => k.moneda_codigo === 'PEN'
  );
  const penSerieDespues = dashDespues.movimientosMensuales.find(
    (s) => s.moneda_codigo === 'PEN'
  );
  const penMesDespues = penSerieDespues?.meses.find(
    (m) => m.periodo === periodoActual
  );
  assert.equal(penKpiDespues?.cartera_por_cobrar, penKpiAntes?.cartera_por_cobrar);
  assert.equal(penMesDespues?.cargos, penMesAntes?.cargos);
  assert.equal(penMesDespues?.abonos, penMesAntes?.abonos);
  console.log('✓ 20. Multimoneda PEN/USD (saldo USD=70, gráfica USD 100/30, PEN intacto y rechazo 2da USD) OK');

  console.log('=== TODAS LAS PRUEBAS APROBADAS ===');
}

run()
  .catch((err) => {
    console.error('Error en verificación:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
