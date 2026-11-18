import { PoolClient } from 'pg';
import { pool, withTransaction } from '../config/db';
import { AppError } from '../types';
import { registrarAuditoria } from '../utils/audit';
import { evaluarAlertasCuenta } from './alertas.service';

export interface RegistrarMovimientoInput {
  id_cuenta: number;
  id_tipo_movimiento: number;
  numero_documento_ref?: string | null;
  fecha_movimiento?: string;
  fecha_vencimiento?: string | null;
  monto: number;
  glosa: string;
  id_cargo_a_aplicar?: number | null;
}

async function obtenerEstadoId(
  client: PoolClient,
  codigo: string
): Promise<number> {
  const res = await client.query<{ id_estado_movimiento: number }>(
    'SELECT id_estado_movimiento FROM tipo_estado_movimiento WHERE codigo = $1',
    [codigo]
  );
  if (res.rows.length === 0) {
    throw new AppError(`Estado de movimiento '${codigo}' no encontrado.`, 500);
  }
  return res.rows[0].id_estado_movimiento;
}

export async function registrarMovimiento(
  input: RegistrarMovimientoInput,
  idUsuario: number
) {
  const monto = Number(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new AppError('El monto del movimiento debe ser mayor a cero.', 400);
  }

  return withTransaction(async (client) => {
    const cuentaRes = await client.query<{
      id_cuenta: number;
      estado: string;
    }>(
      `SELECT id_cuenta, estado
       FROM mae_cuenta_corriente
       WHERE id_cuenta = $1
       FOR UPDATE`,
      [input.id_cuenta]
    );

    if (cuentaRes.rows.length === 0) {
      throw new AppError('Cuenta corriente no encontrada.', 404);
    }
    const cuenta = cuentaRes.rows[0];
    if (cuenta.estado !== 'ACTIVA') {
      throw new AppError(
        `No se pueden registrar movimientos en una cuenta ${cuenta.estado}.`,
        400
      );
    }

    const tipoRes = await client.query<{
      id_tipo_movimiento: number;
      naturaleza: 'C' | 'A';
      requiere_vencimiento: boolean;
    }>(
      `SELECT id_tipo_movimiento, naturaleza, requiere_vencimiento
       FROM tipo_movimiento_cuenta
       WHERE id_tipo_movimiento = $1 AND activo = TRUE`,
      [input.id_tipo_movimiento]
    );
    if (tipoRes.rows.length === 0) {
      throw new AppError('Tipo de movimiento inválido.', 400);
    }
    const tipo = tipoRes.rows[0];

    const idEstadoInicial = await obtenerEstadoId(client, 'PENDIENTE');
    const fechaMov =
      input.fecha_movimiento || new Date().toISOString().slice(0, 10);

    const movRes = await client.query(
      `INSERT INTO trs_movimiento_cuenta
        (id_cuenta, id_tipo_movimiento, id_estado_movimiento, numero_documento_ref,
         fecha_movimiento, fecha_vencimiento, monto, glosa, id_usuario_registro)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9)
       RETURNING *`,
      [
        input.id_cuenta,
        input.id_tipo_movimiento,
        idEstadoInicial,
        input.numero_documento_ref?.trim() || null,
        fechaMov,
        input.fecha_vencimiento || null,
        monto,
        input.glosa.trim(),
        idUsuario,
      ]
    );
    const movimiento = movRes.rows[0];

    // Si es abono y se indicó un cargo específico, aplicar hasta el saldo pendiente del cargo
    if (tipo.naturaleza === 'A' && input.id_cargo_a_aplicar) {
      await aplicarPagoInterno(
        client,
        movimiento.id_movimiento,
        input.id_cargo_a_aplicar,
        monto,
        idUsuario,
        true
      );
    }

    await evaluarAlertasCuenta(
      client,
      input.id_cuenta,
      movimiento.id_movimiento,
      idUsuario
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_movimiento_cuenta',
      idRegistro: movimiento.id_movimiento,
      accion: 'INSERT',
      datosNuevos: movimiento,
      idUsuario,
    });

    return movimiento;
  });
}

/**
 * Aplica un abono a un cargo dentro de una transacción con bloqueo FOR UPDATE
 * en orden determinístico (evita deadlocks) y validación estricta de saldos calculados.
 */
async function aplicarPagoInterno(
  client: PoolClient,
  idAbono: number,
  idCargo: number,
  montoDeseado: number,
  idUsuario: number,
  ajustarAlPendiente = false
) {
  if (idAbono === idCargo) {
    throw new AppError(
      'El movimiento de abono y de cargo no pueden ser el mismo.',
      400
    );
  }

  // Bloqueo en orden ascendente de id_movimiento para prevenir deadlocks
  const idsOrdenados = [idAbono, idCargo].sort((a, b) => a - b);
  await client.query(
    `SELECT id_movimiento FROM trs_movimiento_cuenta
     WHERE id_movimiento = ANY($1::int[])
     ORDER BY id_movimiento ASC
     FOR UPDATE`,
    [idsOrdenados]
  );

  const movsRes = await client.query<{
    id_movimiento: number;
    id_cuenta: number;
    monto: string;
    saldo_pendiente: string;
    naturaleza: 'C' | 'A';
    estado_codigo: string;
  }>(
    `SELECT id_movimiento, id_cuenta, monto, saldo_pendiente, naturaleza, estado_codigo
     FROM vw_movimiento_saldo
     WHERE id_movimiento = ANY($1::int[])`,
    [[idAbono, idCargo]]
  );

  const abono = movsRes.rows.find((m) => m.id_movimiento === idAbono);
  const cargo = movsRes.rows.find((m) => m.id_movimiento === idCargo);

  if (!abono || !cargo) {
    throw new AppError('Movimiento de abono o cargo no encontrado.', 404);
  }
  if (abono.naturaleza !== 'A') {
    throw new AppError(
      'El movimiento origen indicado no corresponde a un abono.',
      400
    );
  }
  if (cargo.naturaleza !== 'C') {
    throw new AppError(
      'El movimiento destino indicado no corresponde a un cargo.',
      400
    );
  }
  if (abono.id_cuenta !== cargo.id_cuenta) {
    throw new AppError(
      'El abono y el cargo deben pertenecer a la misma cuenta corriente.',
      400
    );
  }
  if (abono.estado_codigo === 'ANULADO' || cargo.estado_codigo === 'ANULADO') {
    throw new AppError(
      'Ambos movimientos deben estar confirmados (no anulados) para aplicar el pago.',
      400
    );
  }

  const dispAbono = Number(abono.saldo_pendiente);
  const pendCargo = Number(cargo.saldo_pendiente);

  if (dispAbono <= 0) {
    throw new AppError(
      'El abono seleccionado ya no tiene saldo disponible por aplicar.',
      400
    );
  }
  if (pendCargo <= 0) {
    throw new AppError(
      'El cargo seleccionado ya se encuentra completamente pagado.',
      400
    );
  }

  let montoAplicar = Number(montoDeseado);
  if (ajustarAlPendiente) {
    montoAplicar = Math.min(montoAplicar, dispAbono, pendCargo);
  } else {
    if (montoAplicar > dispAbono) {
      throw new AppError(
        `El importe a aplicar (${montoAplicar.toFixed(2)}) supera el saldo disponible del abono (${dispAbono.toFixed(2)}).`,
        400
      );
    }
    if (montoAplicar > pendCargo) {
      throw new AppError(
        `El importe a aplicar (${montoAplicar.toFixed(2)}) supera el saldo pendiente del cargo (${pendCargo.toFixed(2)}).`,
        400
      );
    }
  }

  const apliRes = await client.query(
    `INSERT INTO trs_aplicacion_pago
      (id_movimiento_abono, id_movimiento_cargo, monto_aplicado, id_usuario_registro)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [idAbono, idCargo, montoAplicar, idUsuario]
  );

  const nuevoPendAbono = Number((dispAbono - montoAplicar).toFixed(2));
  const nuevoPendCargo = Number((pendCargo - montoAplicar).toFixed(2));

  const idEstadoAbono = await obtenerEstadoId(
    client,
    nuevoPendAbono === 0 ? 'APLICADO' : 'PARCIAL'
  );
  const idEstadoCargo = await obtenerEstadoId(
    client,
    nuevoPendCargo === 0 ? 'PAGADO' : 'PARCIAL'
  );

  await client.query(
    `UPDATE trs_movimiento_cuenta SET id_estado_movimiento = $1 WHERE id_movimiento = $2`,
    [idEstadoAbono, idAbono]
  );
  await client.query(
    `UPDATE trs_movimiento_cuenta SET id_estado_movimiento = $1 WHERE id_movimiento = $2`,
    [idEstadoCargo, idCargo]
  );

  await registrarAuditoria(client, {
    tablaAfectada: 'trs_aplicacion_pago',
    idRegistro: apliRes.rows[0].id_aplicacion,
    accion: 'INSERT',
    datosNuevos: apliRes.rows[0],
    idUsuario,
  });

  return apliRes.rows[0];
}

export async function aplicarPago(
  idAbono: number,
  idCargo: number,
  montoAplicado: number,
  idUsuario: number
) {
  if (!Number.isFinite(montoAplicado) || montoAplicado <= 0) {
    throw new AppError('El monto a aplicar debe ser mayor a cero.', 400);
  }
  return withTransaction(async (client) => {
    return aplicarPagoInterno(
      client,
      idAbono,
      idCargo,
      montoAplicado,
      idUsuario,
      false
    );
  });
}

export async function anularMovimiento(
  idMovimiento: number,
  idUsuario: number
) {
  return withTransaction(async (client) => {
    const movRes = await client.query<{
      id_movimiento: number;
      id_cuenta: number;
      monto: string;
      naturaleza: 'C' | 'A';
      estado_codigo: string;
    }>(
      `SELECT m.id_movimiento, m.id_cuenta, m.monto, t.naturaleza, est.codigo AS estado_codigo
       FROM trs_movimiento_cuenta m
       JOIN tipo_movimiento_cuenta t ON t.id_tipo_movimiento = m.id_tipo_movimiento
       JOIN tipo_estado_movimiento est ON est.id_estado_movimiento = m.id_estado_movimiento
       WHERE m.id_movimiento = $1 FOR UPDATE`,
      [idMovimiento]
    );

    if (movRes.rows.length === 0) {
      throw new AppError('Movimiento no encontrado.', 404);
    }
    const mov = movRes.rows[0];
    if (mov.estado_codigo === 'ANULADO') {
      throw new AppError('El movimiento ya se encuentra anulado.', 400);
    }

    const apliRes = await client.query(
      `SELECT 1 FROM trs_aplicacion_pago
       WHERE id_movimiento_abono = $1 OR id_movimiento_cargo = $1 LIMIT 1`,
      [idMovimiento]
    );
    if (apliRes.rows.length > 0) {
      throw new AppError(
        'No se puede anular un movimiento que tiene aplicaciones de pago asociadas.',
        400
      );
    }

    const idAnulado = await obtenerEstadoId(client, 'ANULADO');

    const updated = await client.query(
      `UPDATE trs_movimiento_cuenta
       SET id_estado_movimiento = $1
       WHERE id_movimiento = $2
       RETURNING *`,
      [idAnulado, idMovimiento]
    );

    await evaluarAlertasCuenta(client, mov.id_cuenta, null, idUsuario);

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_movimiento_cuenta',
      idRegistro: idMovimiento,
      accion: 'ANULACION',
      datosAnteriores: mov,
      datosNuevos: updated.rows[0],
      idUsuario,
    });

    return updated.rows[0];
  });
}

export async function listarPendientesPorCuenta(idCuenta: number) {
  const result = await pool.query(
    `SELECT
      id_movimiento,
      numero_documento_ref,
      fecha_movimiento,
      fecha_vencimiento,
      monto,
      monto_aplicado,
      saldo_pendiente,
      glosa,
      tipo_codigo,
      tipo_nombre,
      naturaleza,
      estado_codigo
    FROM vw_movimiento_saldo
    WHERE id_cuenta = $1
      AND saldo_pendiente > 0
      AND estado_codigo <> 'ANULADO'
    ORDER BY fecha_movimiento ASC, id_movimiento ASC`,
    [idCuenta]
  );
  return result.rows;
}
