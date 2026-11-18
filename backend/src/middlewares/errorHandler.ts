import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

/**
 * Middleware centralizado para capturar errores de dominio, PostgreSQL y no controlados.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const pgErr = err as { code?: string; detail?: string; message?: string };
  if (pgErr?.code === '23505') {
    res.status(409).json({
      error: 'Ya existe un registro con los mismos datos únicos.',
      detail: pgErr.detail,
    });
    return;
  }
  if (pgErr?.code === '23503') {
    res.status(400).json({
      error: 'Referencia inválida a un registro relacionado.',
      detail: pgErr.detail,
    });
    return;
  }
  if (pgErr?.code === '23514') {
    res.status(400).json({
      error: 'Los datos incumplen una restricción de validación en base de datos.',
      detail: pgErr.detail,
    });
    return;
  }

  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
