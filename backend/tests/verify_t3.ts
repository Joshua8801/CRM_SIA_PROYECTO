import assert from 'node:assert/strict';
import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../src/config/db';
import { crearCliente } from '../src/services/clientes.service';
import { obtenerCuentaPorId, obtenerEstadoCuenta } from '../src/services/cuentas.service';
import { aplicarPago, registrarMovimiento } from '../src/services/movimientos.service';
import { registrarConciliacion } from '../src/services/conciliaciones.service';

async function run() {
  console.log('=== Verificación Funcional CRM Cuentas Corrientes T3 (13 Casos) ===');
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

  console.log('=== TODAS LAS 13 PRUEBAS APROBADAS ===');
}

run()
  .catch((err) => {
    console.error('Error en verificación:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
