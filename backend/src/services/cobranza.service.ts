import { pool, withTransaction } from '../config/db';
import { AppError } from '../types';
import { registrarAuditoria } from '../utils/audit';
import { validarFechaIso, validarImporte } from '../utils/validation';

export async function listarUsuariosActivos() {
  const res = await pool.query(
    `SELECT id_usuario, nombre_completo, email, rol
     FROM mae_usuario
     WHERE activo = TRUE
     ORDER BY nombre_completo ASC`
  );
  return res.rows;
}

export async function listarGestiones(filtros: {
  estado?: string;
  id_cuenta?: number;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filtros.estado) {
    params.push(filtros.estado);
    conditions.push(`g.estado = $${params.length}`);
  }
  if (filtros.id_cuenta) {
    params.push(filtros.id_cuenta);
    conditions.push(`g.id_cuenta = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT
      g.*,
      vcs.numero_cuenta,
      vcs.saldo_actual,
      vcs.linea_credito,
      c.id_cliente,
      COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
      c.numero_documento,
      tm.codigo AS moneda_codigo,
      tm.simbolo AS moneda_simbolo,
      ur.nombre_completo AS responsable_nombre,
      (SELECT COUNT(*)::int FROM trs_interaccion_cliente i WHERE i.id_gestion = g.id_gestion) AS interacciones_count,
      (SELECT COUNT(*)::int FROM trs_compromiso_pago cp WHERE cp.id_gestion = g.id_gestion) AS compromisos_count
    FROM trs_gestion_cobranza g
    JOIN vw_cuenta_saldo vcs ON vcs.id_cuenta = g.id_cuenta
    JOIN mae_cliente c ON c.id_cliente = vcs.id_cliente
    JOIN tipo_moneda tm ON tm.id_tipo_moneda = vcs.id_tipo_moneda
    JOIN mae_usuario ur ON ur.id_usuario = g.id_usuario_responsable
    ${whereClause}
    ORDER BY
      CASE g.estado WHEN 'ABIERTA' THEN 1 ELSE 2 END,
      g.fecha_apertura DESC`,
    params
  );

  return res.rows;
}

export async function obtenerGestionPorId(idGestion: number) {
  const gestionRes = await pool.query(
    `SELECT
      g.*,
      vcs.numero_cuenta,
      vcs.saldo_actual,
      vcs.linea_credito,
      c.id_cliente,
      COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
      c.numero_documento,
      tm.codigo AS moneda_codigo,
      tm.simbolo AS moneda_simbolo,
      ur.nombre_completo AS responsable_nombre
    FROM trs_gestion_cobranza g
    JOIN vw_cuenta_saldo vcs ON vcs.id_cuenta = g.id_cuenta
    JOIN mae_cliente c ON c.id_cliente = vcs.id_cliente
    JOIN tipo_moneda tm ON tm.id_tipo_moneda = vcs.id_tipo_moneda
    JOIN mae_usuario ur ON ur.id_usuario = g.id_usuario_responsable
    WHERE g.id_gestion = $1`,
    [idGestion]
  );

  if (gestionRes.rows.length === 0) {
    throw new AppError('Gestión de cobranza no encontrada.', 404);
  }

  const gestion = gestionRes.rows[0];

  const [interaccionesRes, dispInteraccionesRes, compromisosRes, abonosRes] =
    await Promise.all([
      pool.query(
        `SELECT
          i.*,
          ti.nombre AS tipo_nombre,
          u.nombre_completo AS usuario_nombre
        FROM trs_interaccion_cliente i
        JOIN tipo_interaccion ti ON ti.id_tipo_interaccion = i.id_tipo_interaccion
        JOIN mae_usuario u ON u.id_usuario = i.id_usuario
        WHERE i.id_gestion = $1
        ORDER BY i.fecha_interaccion DESC`,
        [idGestion]
      ),
      pool.query(
        `SELECT
          i.id_interaccion,
          i.fecha_interaccion,
          i.asunto,
          ti.nombre AS tipo_nombre
        FROM trs_interaccion_cliente i
        JOIN tipo_interaccion ti ON ti.id_tipo_interaccion = i.id_tipo_interaccion
        WHERE i.id_cliente = $1 AND i.id_gestion IS NULL
        ORDER BY i.fecha_interaccion DESC`,
        [gestion.id_cliente]
      ),
      pool.query(
        `SELECT
          cp.*,
          CASE
            WHEN cp.estado = 'PENDIENTE' AND cp.fecha_pactada < CURRENT_DATE THEN 'INCUMPLIDO'
            ELSE cp.estado
          END AS estado_efectivo,
          m.numero_documento_ref AS abono_documento_ref,
          m.fecha_movimiento AS abono_fecha,
          m.monto AS abono_monto
        FROM trs_compromiso_pago cp
        LEFT JOIN trs_movimiento_cuenta m ON m.id_movimiento = cp.id_movimiento_abono
        WHERE cp.id_gestion = $1
        ORDER BY cp.fecha_pactada ASC, cp.id_compromiso ASC`,
        [idGestion]
      ),
      pool.query(
        `SELECT
          v.id_movimiento,
          v.numero_documento_ref,
          v.fecha_movimiento,
          v.monto,
          v.glosa
        FROM vw_movimiento_saldo v
        WHERE v.id_cuenta = $1
          AND v.naturaleza = 'A'
          AND v.estado_codigo <> 'ANULADO'
          AND NOT EXISTS (
            SELECT 1 FROM trs_compromiso_pago cp
            WHERE cp.id_movimiento_abono = v.id_movimiento
          )
        ORDER BY v.fecha_movimiento DESC, v.id_movimiento DESC`,
        [gestion.id_cuenta]
      ),
    ]);

  return {
    gestion,
    interacciones: interaccionesRes.rows,
    interacciones_disponibles: dispInteraccionesRes.rows,
    compromisos: compromisosRes.rows,
    abonos_disponibles: abonosRes.rows,
  };
}

export async function abrirGestion(
  input: {
    id_cuenta: number;
    id_usuario_responsable?: number;
    motivo: string;
  },
  idUsuario: number
) {
  const motivo = input.motivo?.trim();
  if (!motivo) {
    throw new AppError('El motivo de la gestión es obligatorio.', 400);
  }

  return withTransaction(async (client) => {
    const cuentaRes = await client.query(
      'SELECT id_cuenta FROM mae_cuenta_corriente WHERE id_cuenta = $1',
      [input.id_cuenta]
    );
    if (cuentaRes.rows.length === 0) {
      throw new AppError('Cuenta corriente no encontrada.', 404);
    }

    const idResponsable = input.id_usuario_responsable || idUsuario;
    const userRes = await client.query(
      'SELECT id_usuario FROM mae_usuario WHERE id_usuario = $1 AND activo = TRUE',
      [idResponsable]
    );
    if (userRes.rows.length === 0) {
      throw new AppError('Usuario responsable inválido o inactivo.', 400);
    }

    const ins = await client.query(
      `INSERT INTO trs_gestion_cobranza
        (id_cuenta, id_usuario_responsable, motivo, id_usuario_registro)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.id_cuenta, idResponsable, motivo, idUsuario]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_gestion_cobranza',
      idRegistro: ins.rows[0].id_gestion,
      accion: 'INSERT',
      datosNuevos: ins.rows[0],
      idUsuario,
    });

    return ins.rows[0];
  });
}

export async function cerrarGestion(
  idGestion: number,
  observacionesCierre: string | null | undefined,
  idUsuario: number
) {
  return withTransaction(async (client) => {
    const prevRes = await client.query(
      'SELECT * FROM trs_gestion_cobranza WHERE id_gestion = $1 FOR UPDATE',
      [idGestion]
    );
    if (prevRes.rows.length === 0) {
      throw new AppError('Gestión de cobranza no encontrada.', 404);
    }
    const prev = prevRes.rows[0];
    if (prev.estado === 'CERRADA') {
      throw new AppError('La gestión de cobranza ya se encuentra cerrada.', 400);
    }

    const upd = await client.query(
      `UPDATE trs_gestion_cobranza
       SET estado = 'CERRADA',
           fecha_cierre = NOW(),
           observaciones_cierre = $1
       WHERE id_gestion = $2
       RETURNING *`,
      [observacionesCierre?.trim() || null, idGestion]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_gestion_cobranza',
      idRegistro: idGestion,
      accion: 'UPDATE',
      datosAnteriores: prev,
      datosNuevos: upd.rows[0],
      idUsuario,
    });

    return upd.rows[0];
  });
}

export async function vincularInteraccionAGestion(
  idGestion: number,
  idInteraccion: number,
  idUsuario: number
) {
  return withTransaction(async (client) => {
    const gestionRes = await client.query<{
      id_gestion: number;
      id_cliente: number;
    }>(
      `SELECT g.id_gestion, cc.id_cliente
       FROM trs_gestion_cobranza g
       JOIN mae_cuenta_corriente cc ON cc.id_cuenta = g.id_cuenta
       WHERE g.id_gestion = $1 FOR UPDATE OF g`,
      [idGestion]
    );
    if (gestionRes.rows.length === 0) {
      throw new AppError('Gestión de cobranza no encontrada.', 404);
    }

    const intRes = await client.query<{
      id_interaccion: number;
      id_cliente: number;
      id_gestion: number | null;
    }>(
      'SELECT id_interaccion, id_cliente, id_gestion FROM trs_interaccion_cliente WHERE id_interaccion = $1 FOR UPDATE',
      [idInteraccion]
    );
    if (intRes.rows.length === 0) {
      throw new AppError('Interacción no encontrada.', 404);
    }

    const interaccion = intRes.rows[0];
    if (interaccion.id_cliente !== gestionRes.rows[0].id_cliente) {
      throw new AppError(
        'La interacción pertenece a otro cliente y no puede vincularse a esta gestión.',
        400
      );
    }

    const upd = await client.query(
      `UPDATE trs_interaccion_cliente
       SET id_gestion = $1
       WHERE id_interaccion = $2
       RETURNING *`,
      [idGestion, idInteraccion]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_interaccion_cliente',
      idRegistro: idInteraccion,
      accion: 'UPDATE',
      datosAnteriores: interaccion,
      datosNuevos: upd.rows[0],
      idUsuario,
    });

    return upd.rows[0];
  });
}

export async function crearCompromisoPago(
  idGestion: number,
  input: {
    fecha_pactada: string;
    monto_comprometido: unknown;
    observacion?: string | null;
  },
  idUsuario: number
) {
  const fechaPactada = validarFechaIso(
    input.fecha_pactada,
    'La fecha pactada'
  );
  const monto = validarImporte(input.monto_comprometido, {
    campo: 'El monto comprometido',
    permitirCero: false,
  });

  return withTransaction(async (client) => {
    const gestionRes = await client.query<{ estado: string }>(
      'SELECT estado FROM trs_gestion_cobranza WHERE id_gestion = $1 FOR UPDATE',
      [idGestion]
    );
    if (gestionRes.rows.length === 0) {
      throw new AppError('Gestión de cobranza no encontrada.', 404);
    }
    if (gestionRes.rows[0].estado !== 'ABIERTA') {
      throw new AppError(
        'No se pueden registrar compromisos en una gestión cerrada.',
        400
      );
    }

    const ins = await client.query(
      `INSERT INTO trs_compromiso_pago
        (id_gestion, fecha_pactada, monto_comprometido, estado, observacion, id_usuario_registro)
       VALUES ($1, $2::date, $3, 'PENDIENTE', $4, $5)
       RETURNING *`,
      [
        idGestion,
        fechaPactada,
        monto,
        input.observacion?.trim() || null,
        idUsuario,
      ]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_compromiso_pago',
      idRegistro: ins.rows[0].id_compromiso,
      accion: 'INSERT',
      datosNuevos: ins.rows[0],
      idUsuario,
    });

    return ins.rows[0];
  });
}

export async function vincularAbonoACompromiso(
  idCompromiso: number,
  idMovimientoAbono: number,
  idUsuario: number
) {
  return withTransaction(async (client) => {
    const compRes = await client.query<{
      id_compromiso: number;
      id_gestion: number;
      id_cuenta: number;
      fecha_pactada: string;
      monto_comprometido: string;
      estado: string;
      id_movimiento_abono: number | null;
      vencido: boolean;
    }>(
      `SELECT
        cp.*,
        g.id_cuenta,
        (cp.fecha_pactada < CURRENT_DATE) AS vencido
       FROM trs_compromiso_pago cp
       JOIN trs_gestion_cobranza g ON g.id_gestion = cp.id_gestion
       WHERE cp.id_compromiso = $1
       FOR UPDATE OF cp`,
      [idCompromiso]
    );

    if (compRes.rows.length === 0) {
      throw new AppError('Compromiso de pago no encontrado.', 404);
    }
    const comp = compRes.rows[0];

    if (comp.estado === 'CANCELADO') {
      throw new AppError(
        'No se puede vincular un abono a un compromiso cancelado.',
        400
      );
    }
    if (comp.estado === 'CUMPLIDO') {
      throw new AppError(
        'El compromiso ya se encuentra cumplido con un abono vinculado.',
        400
      );
    }

    const movRes = await client.query<{
      id_movimiento: number;
      id_cuenta: number;
      fecha_movimiento: string;
      monto: string;
      naturaleza: 'C' | 'A';
      estado_codigo: string;
      en_plazo: boolean;
    }>(
      `SELECT
        m.id_movimiento,
        m.id_cuenta,
        m.fecha_movimiento::text,
        m.monto,
        t.naturaleza,
        est.codigo AS estado_codigo,
        (m.fecha_movimiento <= $2::date) AS en_plazo
       FROM trs_movimiento_cuenta m
       JOIN tipo_movimiento_cuenta t ON t.id_tipo_movimiento = m.id_tipo_movimiento
       JOIN tipo_estado_movimiento est ON est.id_estado_movimiento = m.id_estado_movimiento
       WHERE m.id_movimiento = $1
       FOR UPDATE OF m`,
      [idMovimientoAbono, comp.fecha_pactada]
    );

    if (movRes.rows.length === 0) {
      throw new AppError('Movimiento de abono no encontrado.', 404);
    }
    const mov = movRes.rows[0];

    if (mov.id_cuenta !== comp.id_cuenta) {
      throw new AppError(
        'El abono seleccionado pertenece a otra cuenta corriente.',
        400
      );
    }
    if (mov.naturaleza !== 'A') {
      throw new AppError(
        'Solo se puede vincular un movimiento de naturaleza ABONO.',
        400
      );
    }
    if (mov.estado_codigo === 'ANULADO') {
      throw new AppError(
        'No se puede vincular un abono anulado.',
        400
      );
    }

    const yaUsadoRes = await client.query(
      `SELECT id_compromiso FROM trs_compromiso_pago
       WHERE id_movimiento_abono = $1 AND id_compromiso <> $2`,
      [idMovimientoAbono, idCompromiso]
    );
    if (yaUsadoRes.rows.length > 0) {
      throw new AppError(
        'Este abono ya está vinculado a otro compromiso de pago.',
        409
      );
    }

    if (!mov.en_plazo) {
      throw new AppError(
        'La fecha del abono es posterior a la fecha pactada del compromiso.',
        400
      );
    }

    const montoAbono = Number(mov.monto);
    const montoComp = Number(comp.monto_comprometido);

    if (montoAbono < montoComp) {
      if (comp.vencido) {
        await client.query(
          `UPDATE trs_compromiso_pago
           SET estado = 'INCUMPLIDO', fecha_actualizacion = NOW()
           WHERE id_compromiso = $1`,
          [idCompromiso]
        );
      }
      throw new AppError(
        `El abono (${montoAbono.toFixed(2)}) es menor al monto comprometido (${montoComp.toFixed(2)}). El compromiso permanece ${comp.vencido ? 'INCUMPLIDO' : 'PENDIENTE'}.`,
        400
      );
    }

    const upd = await client.query(
      `UPDATE trs_compromiso_pago
       SET id_movimiento_abono = $1,
           estado = 'CUMPLIDO',
           fecha_actualizacion = NOW()
       WHERE id_compromiso = $2
       RETURNING *`,
      [idMovimientoAbono, idCompromiso]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_compromiso_pago',
      idRegistro: idCompromiso,
      accion: 'UPDATE',
      datosAnteriores: comp,
      datosNuevos: upd.rows[0],
      idUsuario,
    });

    return upd.rows[0];
  });
}

export async function cancelarCompromiso(
  idCompromiso: number,
  idUsuario: number
) {
  return withTransaction(async (client) => {
    const prevRes = await client.query(
      'SELECT * FROM trs_compromiso_pago WHERE id_compromiso = $1 FOR UPDATE',
      [idCompromiso]
    );
    if (prevRes.rows.length === 0) {
      throw new AppError('Compromiso de pago no encontrado.', 404);
    }
    const prev = prevRes.rows[0];
    if (prev.estado === 'CUMPLIDO') {
      throw new AppError(
        'No se puede cancelar un compromiso que ya fue cumplido.',
        400
      );
    }

    const upd = await client.query(
      `UPDATE trs_compromiso_pago
       SET estado = 'CANCELADO',
           fecha_actualizacion = NOW()
       WHERE id_compromiso = $1
       RETURNING *`,
      [idCompromiso]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_compromiso_pago',
      idRegistro: idCompromiso,
      accion: 'UPDATE',
      datosAnteriores: prev,
      datosNuevos: upd.rows[0],
      idUsuario,
    });

    return upd.rows[0];
  });
}
