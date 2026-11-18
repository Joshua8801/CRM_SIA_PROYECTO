import { pool, withTransaction } from '../config/db';
import { AppError } from '../types';
import { registrarAuditoria } from '../utils/audit';

export async function listarInteracciones(idCliente?: number) {
  const params: unknown[] = [];
  let whereClause = '';
  if (idCliente) {
    params.push(idCliente);
    whereClause = 'WHERE i.id_cliente = $1';
  }

  const result = await pool.query(
    `SELECT
      i.*,
      COALESCE(c.razon_social, c.nombre_completo) AS cliente_nombre,
      c.numero_documento,
      ti.codigo AS tipo_codigo,
      ti.nombre AS tipo_nombre,
      u.nombre_completo AS usuario_nombre
    FROM trs_interaccion_cliente i
    JOIN mae_cliente c ON c.id_cliente = i.id_cliente
    JOIN tipo_interaccion ti ON ti.id_tipo_interaccion = i.id_tipo_interaccion
    JOIN mae_usuario u ON u.id_usuario = i.id_usuario
    ${whereClause}
    ORDER BY i.fecha_interaccion DESC`,
    params
  );

  return result.rows;
}

export async function crearInteraccion(
  input: {
    id_cliente: number;
    id_tipo_interaccion: number;
    asunto: string;
    detalle: string;
    resultado?: string | null;
    fecha_proximo_seguimiento?: string | null;
  },
  idUsuario: number
) {
  return withTransaction(async (client) => {
    const cli = await client.query(
      'SELECT id_cliente FROM mae_cliente WHERE id_cliente = $1',
      [input.id_cliente]
    );
    if (cli.rows.length === 0) {
      throw new AppError('Cliente no encontrado.', 404);
    }

    const res = await client.query(
      `INSERT INTO trs_interaccion_cliente
        (id_cliente, id_tipo_interaccion, id_usuario, asunto, detalle, resultado, fecha_proximo_seguimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date)
       RETURNING *`,
      [
        input.id_cliente,
        input.id_tipo_interaccion,
        idUsuario,
        input.asunto.trim(),
        input.detalle.trim(),
        input.resultado?.trim() || null,
        input.fecha_proximo_seguimiento || null,
      ]
    );

    await registrarAuditoria(client, {
      tablaAfectada: 'trs_interaccion_cliente',
      idRegistro: res.rows[0].id_interaccion,
      accion: 'INSERT',
      datosNuevos: res.rows[0],
      idUsuario,
    });

    return res.rows[0];
  });
}
