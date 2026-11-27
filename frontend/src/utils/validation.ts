export const MAX_MONTO_NUMERIC = 999_999_999_999.99;

const REGEX_DECIMAL_2 = /^-?\d+(\.\d{1,2})?$/;
const TIPOS_COMPROBANTE = new Set([
  'CARGO_FACTURA',
  'CARGO_NOTA_DEB',
  'ABONO_NOTA_CRED',
]);

export function validarImporteFrontend(
  raw: string,
  opts: { campo: string; permitirCero?: boolean; permitirNegativo?: boolean }
): { ok: true; valor: number } | { ok: false; error: string } {
  const { campo, permitirCero = false, permitirNegativo = false } = opts;
  const texto = raw.trim();
  if (!texto) {
    return { ok: false, error: `${campo} es obligatorio.` };
  }
  if (!REGEX_DECIMAL_2.test(texto)) {
    return {
      ok: false,
      error: `${campo} debe ser un número válido con un máximo de 2 decimales.`,
    };
  }
  const valor = Number(texto);
  if (!Number.isFinite(valor)) {
    return { ok: false, error: `${campo} debe ser un importe numérico válido.` };
  }
  if (!permitirNegativo) {
    if (permitirCero) {
      if (valor < 0) {
        return { ok: false, error: `${campo} no puede ser negativo.` };
      }
    } else if (valor <= 0) {
      return { ok: false, error: `${campo} debe ser mayor a cero.` };
    }
  }
  if (Math.abs(valor) > MAX_MONTO_NUMERIC) {
    return {
      ok: false,
      error: `${campo} supera el máximo permitido (999,999,999,999.99).`,
    };
  }
  return { ok: true, valor };
}

export function validarFechaIsoFrontend(
  raw: string,
  campo: string
): { ok: true; valor: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: `${campo} es obligatoria.` };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      error: `${campo} debe tener formato válido YYYY-MM-DD.`,
    };
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
    return { ok: false, error: `${campo} no corresponde a una fecha válida.` };
  }
  return { ok: true, valor: trimmed };
}

export function validarPeriodoFrontend(
  fechaInicioRaw: string,
  fechaFinRaw: string
): { ok: true; fechaInicio: string; fechaFin: string } | { ok: false; error: string } {
  const ini = validarFechaIsoFrontend(fechaInicioRaw, 'La fecha de inicio');
  if (!ini.ok) return ini;
  const fin = validarFechaIsoFrontend(fechaFinRaw, 'La fecha de fin');
  if (!fin.ok) return fin;
  if (fin.valor < ini.valor) {
    return {
      ok: false,
      error: 'La fecha fin no puede ser menor que la fecha inicio.',
    };
  }
  return { ok: true, fechaInicio: ini.valor, fechaFin: fin.valor };
}

export function validarEmailOpcionalFrontend(
  raw: string
): { ok: true; valor: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, valor: null };
  if (trimmed.length > 120) {
    return {
      ok: false,
      error: 'El correo electrónico no puede superar los 120 caracteres.',
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return {
      ok: false,
      error: 'El correo electrónico no tiene un formato válido.',
    };
  }
  return { ok: true, valor: trimmed };
}

export function validarTelefonoOpcionalFrontend(
  raw: string
): { ok: true; valor: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, valor: null };
  if (trimmed.length > 30) {
    return {
      ok: false,
      error: 'El teléfono no puede superar los 30 caracteres.',
    };
  }
  if (
    !/^[0-9+\-\s()]{6,30}$/.test(trimmed) ||
    trimmed.replace(/\D/g, '').length < 6
  ) {
    return {
      ok: false,
      error:
        'El teléfono debe tener entre 6 y 30 caracteres y contener al menos 6 dígitos.',
    };
  }
  return { ok: true, valor: trimmed };
}

export function validarComprobanteFrontend(
  raw: string,
  tipoCodigo: string
): { ok: true; valor: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (TIPOS_COMPROBANTE.has(tipoCodigo)) {
      return {
        ok: false,
        error: 'El número de comprobante es obligatorio para este movimiento.',
      };
    }
    return { ok: true, valor: null };
  }
  if (trimmed.length > 40) {
    return {
      ok: false,
      error: 'El número de comprobante no puede superar los 40 caracteres.',
    };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9\s\-\/]*[A-Za-z0-9]$|^[A-Za-z0-9]$/.test(trimmed)) {
    return {
      ok: false,
      error: 'El número de comprobante contiene caracteres inválidos.',
    };
  }
  if (tipoCodigo === 'CARGO_FACTURA') {
    if (!/^(?:F|B)[A-Z0-9]*\s*-\s*[A-Z0-9-]+$/i.test(trimmed)) {
      return {
        ok: false,
        error:
          'El comprobante de factura debe tener un formato válido (ej. F001-000123 o B001-000123).',
      };
    }
  } else if (tipoCodigo === 'CARGO_NOTA_DEB') {
    if (!/^ND[A-Z0-9]*\s*-\s*[A-Z0-9-]+$/i.test(trimmed)) {
      return {
        ok: false,
        error:
          'El comprobante de nota de débito debe iniciar con ND y un guion (ej. ND01-000123).',
      };
    }
  } else if (tipoCodigo === 'ABONO_NOTA_CRED') {
    if (!/^NC[A-Z0-9]*\s*-\s*[A-Z0-9-]+$/i.test(trimmed)) {
      return {
        ok: false,
        error:
          'El comprobante de nota de crédito debe iniciar con NC y un guion (ej. NC01-000123).',
      };
    }
  }
  return { ok: true, valor: trimmed };
}

export function validarGlosaFrontend(
  raw: string
): { ok: true; valor: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'La glosa no puede quedar vacía.' };
  }
  if (trimmed.length > 250) {
    return {
      ok: false,
      error: 'La glosa no puede superar los 250 caracteres.',
    };
  }
  return { ok: true, valor: trimmed };
}
