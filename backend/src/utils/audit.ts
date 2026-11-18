import { PoolClient } from 'pg';

export type AccionAuditoria = 'INSERT' | 'UPDATE' | 'DELETE' | 'ANULACION';

interface RegistroAuditoriaInput {
  tablaAfectada: string;
  idRegistro: string | number;
  accion: AccionAuditoria;
  datosAnteriores?: unknown;
  datosNuevos?: unknown;
  idUsuario?: number | null;
}

/**
 * Registra un evento en trs_auditoria dentro de la transacción activa.
 */
export async function registrarAuditoria(
  client: PoolClient,
  input: RegistroAuditoriaInput
): Promise<void> {
  await client.query(
    `INSERT INTO trs_auditoria
      (tabla_afectada, id_registro, accion, datos_anteriores, datos_nuevos, id_usuario)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.tablaAfectada,
      String(input.idRegistro),
      input.accion,
      input.datosAnteriores ? JSON.stringify(input.datosAnteriores) : null,
      input.datosNuevos ? JSON.stringify(input.datosNuevos) : null,
      input.idUsuario ?? null,
    ]
  );
}
