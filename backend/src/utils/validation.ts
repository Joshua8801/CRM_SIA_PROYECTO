import { AppError } from '../types';

export const MAX_MONTO_NUMERIC = 999_999_999_999.99;

const REGEX_DECIMAL_2 = /^-?\d+(\.\d{1,2})?$/;
const TIPOS_COMPROBANTE = new Set([
  'CARGO_FACTURA',
  'CARGO_NOTA_DEB',
  'ABONO_NOTA_CRED',
]);

export function validarImporte(
  raw: unknown,
  opts: { campo: string; permitirCero?: boolean; permitirNegativo?: boolean }
): number {
  const { campo, permitirCero = false, permitirNegativo = false } = opts;

  if (raw === undefined || raw === null) {
    throw new AppError(`${campo} es obligatorio.`, 400);
  }
  if (typeof raw === 'boolean') {
    throw new AppError(`${campo} debe ser un importe numérico válido.`, 400);
  }

  let texto: string;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      throw new AppError(`${campo} debe ser un importe numérico finito.`, 400);
    }
    texto = String(raw);
  } else if (typeof raw === 'string') {
    texto = raw.trim();
    if (texto.length === 0) {
      throw new AppError(`${campo} es obligatorio.`, 400);
    }
  } else {
    throw new AppError(`${campo} debe ser un importe numérico válido.`, 400);
  }

  if (!REGEX_DECIMAL_2.test(texto)) {
    throw new AppError(
      `${campo} debe ser un número válido con un máximo de 2 decimales.`,
      400
    );
  }

  const valor = Number(texto);
  if (!Number.isFinite(valor)) {
    throw new AppError(`${campo} debe ser un importe numérico válido.`, 400);
  }

  if (!permitirNegativo) {
    if (permitirCero) {
      if (valor < 0) {
        throw new AppError(`${campo} no puede ser negativo.`, 400);
      }
    } else if (valor <= 0) {
      throw new AppError(`${campo} debe ser mayor a cero.`, 400);
    }
  }

  if (Math.abs(valor) > MAX_MONTO_NUMERIC) {
    throw new AppError(
      `${campo} supera el máximo permitido (999,999,999,999.99).`,
      400
    );
  }

  return valor;
}

export function validarFechaIso(raw: unknown, campo: string): string {
  if (typeof raw !== 'string') {
    throw new AppError(`${campo} es obligatoria.`, 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AppError(`${campo} es obligatoria.`, 400);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new AppError(
      `${campo} debe tener formato válido YYYY-MM-DD.`,
      400
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    throw new AppError(`${campo} no corresponde a una fecha válida.`, 400);
  }
  return trimmed;
}

export function validarPeriodo(
  fechaInicioRaw: unknown,
  fechaFinRaw: unknown
): { fechaInicio: string; fechaFin: string } {
  const fechaInicio = validarFechaIso(fechaInicioRaw, 'La fecha de inicio');
  const fechaFin = validarFechaIso(fechaFinRaw, 'La fecha de fin');
  if (fechaFin < fechaInicio) {
    throw new AppError(
      'La fecha fin no puede ser menor que la fecha inicio.',
      400
    );
  }
  return { fechaInicio, fechaFin };
}

export function parseIdPositivo(raw: unknown, campo = 'ID'): number {
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw <= 0) {
      throw new AppError(`${campo} inválido.`, 400);
    }
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new AppError(`${campo} inválido.`, 400);
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num) || num <= 0) {
      throw new AppError(`${campo} inválido.`, 400);
    }
    return num;
  }
  throw new AppError(`${campo} inválido.`, 400);
}

export function parseIdOpcional(
  raw: unknown,
  campo = 'ID'
): number | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  return parseIdPositivo(raw, campo);
}

export function validarTextoRequerido(
  raw: unknown,
  campo: string,
  maxLen?: number
): string {
  if (typeof raw !== 'string') {
    throw new AppError(`${campo} es obligatorio.`, 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AppError(`${campo} no puede quedar vacío.`, 400);
  }
  if (maxLen !== undefined && trimmed.length > maxLen) {
    throw new AppError(
      `${campo} no puede superar los ${maxLen} caracteres.`,
      400
    );
  }
  return trimmed;
}

export function validarTextoOpcional(
  raw: unknown,
  campo: string,
  maxLen: number
): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new AppError(`${campo} debe ser texto.`, 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    throw new AppError(
      `${campo} no puede superar los ${maxLen} caracteres.`,
      400
    );
  }
  return trimmed;
}

export function validarEmailOpcional(raw: unknown): string | null {
  const trimmed = validarTextoOpcional(raw, 'El correo electrónico', 120);
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new AppError('El correo electrónico no tiene un formato válido.', 400);
  }
  return trimmed;
}

export function validarTelefonoOpcional(raw: unknown): string | null {
  const trimmed = validarTextoOpcional(raw, 'El teléfono', 30);
  if (!trimmed) return null;
  if (!/^[0-9+\-\s()]{6,30}$/.test(trimmed) || !/\d{6,}/.test(trimmed.replace(/\D/g, ''))) {
    throw new AppError(
      'El teléfono debe tener entre 6 y 30 caracteres y contener al menos 6 dígitos.',
      400
    );
  }
  return trimmed;
}

export function validarComprobante(
  raw: unknown,
  tipoCodigo: string
): string | null {
  if (raw !== undefined && raw !== null && typeof raw !== 'string') {
    throw new AppError('El número de comprobante debe ser texto.', 400);
  }

  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    if (TIPOS_COMPROBANTE.has(tipoCodigo)) {
      throw new AppError(
        'El número de comprobante es obligatorio para este movimiento.',
        400
      );
    }
    return null;
  }

  if (trimmed.length > 40) {
    throw new AppError(
      'El número de comprobante no puede superar los 40 caracteres.',
      400
    );
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9\s\-\/]*[A-Za-z0-9]$|^[A-Za-z0-9]$/.test(trimmed)) {
    throw new AppError(
      'El número de comprobante contiene caracteres inválidos.',
      400
    );
  }

  if (tipoCodigo === 'CARGO_FACTURA') {
    if (!/^(?:F|B)[A-Z0-9]*\s*-\s*[A-Z0-9-]+$/i.test(trimmed)) {
      throw new AppError(
        'El comprobante de factura debe tener un formato válido (ej. F001-000123 o B001-000123).',
        400
      );
    }
  } else if (tipoCodigo === 'CARGO_NOTA_DEB') {
    if (!/^ND[A-Z0-9]*\s*-\s*[A-Z0-9-]+$/i.test(trimmed)) {
      throw new AppError(
        'El comprobante de nota de débito debe iniciar con ND y un guion (ej. ND01-000123).',
        400
      );
    }
  } else if (tipoCodigo === 'ABONO_NOTA_CRED') {
    if (!/^NC[A-Z0-9]*\s*-\s*[A-Z0-9-]+$/i.test(trimmed)) {
      throw new AppError(
        'El comprobante de nota de crédito debe iniciar con NC y un guion (ej. NC01-000123).',
        400
      );
    }
  }

  return trimmed;
}

export function validarGlosa(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new AppError('La glosa es obligatoria.', 400);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new AppError('La glosa no puede quedar vacía.', 400);
  }
  if (trimmed.length > 250) {
    throw new AppError(
      'La glosa no puede superar los 250 caracteres.',
      400
    );
  }
  return trimmed;
}
