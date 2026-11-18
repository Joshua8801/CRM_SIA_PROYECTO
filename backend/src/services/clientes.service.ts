import { pool, withTransaction } from '../config/db';
import { AppError } from '../types';
import { registrarAuditoria } from '../utils/audit';
import { evaluarAlertasCuenta } from './alertas.service';

export type TipoPersona = 'NATURAL' | 'JURIDICA';

export interface ClienteInput {
  tipo_persona: TipoPersona;
  id_tipo_documento: number;
  numero_documento: string;
  nombre_completo?: string | null;
  razon_social?: string | null;
  nombre_comercial?: string | null;
  id_segmento: number;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  estado?: 'ACTIVO' | 'BLOQUEADO' | 'INACTIVO';
  id_tipo_moneda?: number;
  linea_credito?: number;
}

function normalizarNombresPersona(
  tipoPersona: TipoPersona,
  nombreCompleto?: string | null,
  razonSocial?: string | null
) {
  if (tipoPersona === 'NATURAL') {
    const limpio = nombreCompleto?.trim() || '';
    if (!limpio) {
      throw new AppError(
        'El nombre completo es obligatorio para persona natural.',
        400
      );
    }
    return { nombre_completo: limpio, razon_social: null };
  }
  if (tipoPersona === 'JURIDICA') {
    const limpio = razonSocial?.trim() || '';
    if (!limpio) {
      throw new AppError(
        'La razón social es obligatoria para persona jurídica.',
        400
      );
    }
    return { nombre_completo: null, razon_social: limpio };
  }
  throw new AppError('Tipo de persona inválido. Use NATURAL o JURIDICA.', 400);
}

export async function listarClientes(filtros: {
  search?: string;
  id_segmento?: number;
  estado?: string;
  tipo_persona?: string;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filtros.search) {
    params.push(`%${filtros.search.trim()}%`);
    conditions.push(
      `(COALESCE(c.razon_social, '') ILIKE $${params.length}
        OR COALESCE(c.nombre_completo, '') ILIKE $${params.length}
        OR c.numero_documento ILIKE $${params.length}
        OR COALESCE(c.nombre_comercial, '') ILIKE $${params.length})`
    );
  }
  if (filtros.id_segmento) {
    params.push(filtros.id_segmento);
    conditions.push(`c.id_segmento = $${params.length}`);
  }
  if (filtros.estado) {
    params.push(filtros.estado);
    conditions.push(`c.estado = $${params.length}`);
  }
  if (filtros.tipo_persona) {
    params.push(filtros.tipo_persona);
    conditions.push(`c.tipo_persona = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
      c.*,
      COALESCE(c.razon_social, c.nombre_completo) AS nombre_display,
      td.codigo AS tipo_documento_codigo,
      td.nombre AS tipo_documento_nombre,
      s.codigo AS segmento_codigo,
      s.nombre AS segmento_nombre,
      COALESCE(SUM(vcs.linea_credito), 0)::numeric(14,2) AS linea_credito_total,
      COALESCE(SUM(vcs.saldo_actual), 0)::numeric(14,2) AS saldo_total,
      COUNT(vcs.id_cuenta)::int AS cantidad_cuentas,
      COALESCE(BOOL_OR(vcs.excede_linea), FALSE) AS excede_linea
    FROM mae_cliente c
    JOIN tipo_documento td ON td.id_tipo_documento = c.id_tipo_documento
    JOIN cat_segmento_cliente s ON s.id_segmento = c.id_segmento
    LEFT JOIN vw_cuenta_saldo vcs ON vcs.id_cliente = c.id_cliente
    ${whereClause}
    GROUP BY c.id_cliente, td.codigo, td.nombre, s.codigo, s.nombre
    ORDER BY c.fecha_registro DESC`,
    params
  );

  return result.rows;
}

export async function obtenerClientePorId(idCliente: number) {
  const clienteRes = await pool.query(
    `SELECT
      c.*,
      COALESCE(c.razon_social, c.nombre_completo) AS nombre_display,
      td.codigo AS tipo_documento_codigo,
      td.nombre AS tipo_documento_nombre,
      s.codigo AS segmento_codigo,
      s.nombre AS segmento_nombre
    FROM mae_cliente c
    JOIN tipo_documento td ON td.id_tipo_documento = c.id_tipo_documento
    JOIN cat_segmento_cliente s ON s.id_segmento = c.id_segmento
    WHERE c.id_cliente = $1`,
    [idCliente]
  );

  if (clienteRes.rows.length === 0) {
    throw new AppError('Cliente no encontrado.', 404);
  }

  const cuentasRes = await pool.query(
    `SELECT
      vcs.*,
      tm.codigo AS moneda_codigo,
      tm.nombre AS moneda_nombre,
      tm.simbolo AS moneda_simbolo
    FROM vw_cuenta_saldo vcs
    JOIN tipo_moneda tm ON tm.id_tipo_moneda = vcs.id_tipo_moneda
    WHERE vcs.id_cliente = $1
    ORDER BY vcs.id_cuenta`,
    [idCliente]
  );

  return {
    ...clienteRes.rows[0],
    cuentas: cuentasRes.rows,
  };
}

export async function crearCliente(input: ClienteInput, idUsuario: number) {
  const nombres = normalizarNombresPersona(
    input.tipo_persona,
    input.nombre_completo,
    input.razon_social
  );

  return withTransaction(async (client) => {
    const docRes = await client.query<{
      longitud_exacta: number | null;
      nombre: string;
    }>(
      'SELECT longitud_exacta, nombre FROM tipo_documento WHERE id_tipo_documento = $1 AND activo = TRUE',
      [input.id_tipo_documento]
    );
    if (docRes.rows.length === 0) {
      throw new AppError('Tipo de documento inválido.', 400);
    }

    const numDoc = input.numero_documento.trim();
    const longExacta = docRes.rows[0].longitud_exacta;
    if (longExacta && numDoc.length !== longExacta) {
      throw new AppError(
        `El documento ${docRes.rows[0].nombre} debe tener exactamente ${longExacta} caracteres.`,
        400
      );
    }

    const segRes = await client.query<{ linea_credito_sugerida: string }>(
      'SELECT linea_credito_sugerida FROM cat_segmento_cliente WHERE id_segmento = $1 AND activo = TRUE',
      [input.id_segmento]
    );
    if (segRes.rows.length === 0) {
      throw new AppError('Segmento de cliente inválido.', 400);
    }

    const clienteRes = await client.query(
      `INSERT INTO mae_cliente
        (tipo_persona, id_tipo_documento, numero_documento, nombre_completo, razon_social,
         nombre_comercial, id_segmento, email, telefono, direccion, id_usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.tipo_persona,
        input.id_tipo_documento,
        numDoc,
        nombres.nombre_completo,
        nombres.razon_social,
        input.nombre_comercial?.trim() || null,
        input.id_segmento,
        input.email?.trim() || null,
        input.telefono?.trim() || null,
        input.direccion?.trim() || null,
        idUsuario,
      ]
    );

    const cliente = clienteRes.rows[0];

    let idMoneda = input.id_tipo_moneda;
    let codigoMoneda = 'PEN';
    if (idMoneda) {
      const mRes = await client.query<{ codigo: string }>(
        'SELECT codigo FROM tipo_moneda WHERE id_tipo_moneda = $1 AND activo = TRUE',
        [idMoneda]
      );
      if (mRes.rows.length === 0) {
        throw new AppError('Tipo de moneda inválido.', 400);
      }
      codigoMoneda = mRes.rows[0].codigo;
    } else {
      const mDef = await client.query<{ id_tipo_moneda: number; codigo: string }>(
        'SELECT id_tipo_moneda, codigo FROM tipo_moneda WHERE activo = TRUE ORDER BY id_tipo_moneda LIMIT 1'
      );
      idMoneda = mDef.rows[0].id_tipo_moneda;
      codigoMoneda = mDef.rows[0].codigo;
    }

    const lineaCredito =
      input.linea_credito !== undefined
        ? Number(input.linea_credito)
        : Number(segRes.rows[0].linea_credito_sugerida);

    if (lineaCredito < 0) {
      throw new AppError('La línea de crédito no puede ser negativa.', 400);
    }

    const numeroCuenta = `CC-${String(cliente.id_cliente).padStart(5, '0')}-${codigoMoneda}`;

    const cuentaRes = await client.query(
      `INSERT INTO mae_cuenta_corriente
        (id_cliente, id_tipo_moneda, numero_cuenta, linea_credito)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [cliente.id_cliente, idMoneda, numeroCuenta, lineaCredito]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'mae_cliente',
      idRegistro: cliente.id_cliente,
      accion: 'INSERT',
      datosNuevos: cliente,
      idUsuario,
    });

    await registrarAuditoria(client, {
      tablaAfectada: 'mae_cuenta_corriente',
      idRegistro: cuentaRes.rows[0].id_cuenta,
      accion: 'INSERT',
      datosNuevos: cuentaRes.rows[0],
      idUsuario,
    });

    return {
      ...cliente,
      nombre_display: cliente.razon_social || cliente.nombre_completo,
      cuenta_inicial: cuentaRes.rows[0],
    };
  });
}

export async function actualizarCliente(
  idCliente: number,
  input: Partial<ClienteInput>,
  idUsuario: number
) {
  return withTransaction(async (client) => {
    const prevRes = await client.query(
      'SELECT * FROM mae_cliente WHERE id_cliente = $1 FOR UPDATE',
      [idCliente]
    );
    if (prevRes.rows.length === 0) {
      throw new AppError('Cliente no encontrado.', 404);
    }
    const prev = prevRes.rows[0];

    const tipoPersona: TipoPersona = input.tipo_persona || prev.tipo_persona;
    const nombres = normalizarNombresPersona(
      tipoPersona,
      input.nombre_completo !== undefined
        ? input.nombre_completo
        : prev.nombre_completo,
      input.razon_social !== undefined ? input.razon_social : prev.razon_social
    );

    const updatedRes = await client.query(
      `UPDATE mae_cliente
       SET tipo_persona = $1,
           nombre_completo = $2,
           razon_social = $3,
           nombre_comercial = $4,
           id_segmento = COALESCE($5, id_segmento),
           email = $6,
           telefono = $7,
           direccion = $8,
           estado = COALESCE($9, estado),
           fecha_actualizacion = NOW()
       WHERE id_cliente = $10
       RETURNING *`,
      [
        tipoPersona,
        nombres.nombre_completo,
        nombres.razon_social,
        input.nombre_comercial !== undefined
          ? input.nombre_comercial?.trim() || null
          : prev.nombre_comercial,
        input.id_segmento ?? null,
        input.email !== undefined ? input.email?.trim() || null : prev.email,
        input.telefono !== undefined
          ? input.telefono?.trim() || null
          : prev.telefono,
        input.direccion !== undefined
          ? input.direccion?.trim() || null
          : prev.direccion,
        input.estado ?? null,
        idCliente,
      ]
    );

    if (input.linea_credito !== undefined) {
      const nuevaLinea = Number(input.linea_credito);
      if (nuevaLinea < 0) {
        throw new AppError('La línea de crédito no puede ser negativa.', 400);
      }
      const cuentas = await client.query<{ id_cuenta: number }>(
        'SELECT id_cuenta FROM mae_cuenta_corriente WHERE id_cliente = $1 ORDER BY id_cuenta LIMIT 1 FOR UPDATE',
        [idCliente]
      );
      if (cuentas.rows.length > 0) {
        const idCuenta = cuentas.rows[0].id_cuenta;
        const prevCuenta = await client.query(
          'SELECT * FROM mae_cuenta_corriente WHERE id_cuenta = $1',
          [idCuenta]
        );
        const updCuenta = await client.query(
          `UPDATE mae_cuenta_corriente
           SET linea_credito = $1, fecha_actualizacion = NOW()
           WHERE id_cuenta = $2
           RETURNING *`,
          [nuevaLinea, idCuenta]
        );
        await registrarAuditoria(client, {
          tablaAfectada: 'mae_cuenta_corriente',
          idRegistro: idCuenta,
          accion: 'UPDATE',
          datosAnteriores: prevCuenta.rows[0],
          datosNuevos: updCuenta.rows[0],
          idUsuario,
        });
        await evaluarAlertasCuenta(client, idCuenta, null, idUsuario);
      }
    }

    await registrarAuditoria(client, {
      tablaAfectada: 'mae_cliente',
      idRegistro: idCliente,
      accion: 'UPDATE',
      datosAnteriores: prev,
      datosNuevos: updatedRes.rows[0],
      idUsuario,
    });

    return updatedRes.rows[0];
  });
}
