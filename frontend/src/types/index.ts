export type RolUsuario = 'ADMIN' | 'ANALISTA' | 'CONSULTA';
export type TipoPersona = 'NATURAL' | 'JURIDICA';

export interface Usuario {
  id_usuario: number;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
}

export interface Catalogos {
  tiposDocumento: Array<{
    id_tipo_documento: number;
    codigo: string;
    nombre: string;
    longitud_exacta: number | null;
  }>;
  tiposMoneda: Array<{
    id_tipo_moneda: number;
    codigo: string;
    nombre: string;
    simbolo: string;
  }>;
  segmentos: Array<{
    id_segmento: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    linea_credito_sugerida: string;
    dias_plazo_defecto: number;
  }>;
  tiposMovimiento: Array<{
    id_tipo_movimiento: number;
    codigo: string;
    nombre: string;
    naturaleza: 'C' | 'A';
    requiere_vencimiento: boolean;
  }>;
  tiposInteraccion: Array<{
    id_tipo_interaccion: number;
    codigo: string;
    nombre: string;
  }>;
  estadosMovimiento: Array<{
    id_estado_movimiento: number;
    codigo: string;
    nombre: string;
  }>;
}

export interface Cliente {
  id_cliente: number;
  tipo_persona: TipoPersona;
  id_tipo_documento: number;
  tipo_documento_codigo: string;
  tipo_documento_nombre: string;
  numero_documento: string;
  nombre_completo: string | null;
  razon_social: string | null;
  nombre_display: string;
  nombre_comercial: string | null;
  id_segmento: number;
  segmento_codigo: string;
  segmento_nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  estado: 'ACTIVO' | 'BLOQUEADO' | 'INACTIVO';
  linea_credito_total: string;
  saldo_total: string;
  excede_linea: boolean;
  fecha_registro: string;
}

export interface CuentaCorriente {
  id_cuenta: number;
  id_cliente: number;
  id_tipo_moneda: number;
  numero_cuenta: string;
  linea_credito: string;
  total_cargos?: string;
  total_abonos?: string;
  saldo_actual: string;
  credito_disponible: string;
  excede_linea: boolean;
  estado: 'ACTIVA' | 'SUSPENDIDA' | 'CERRADA';
  fecha_apertura: string;
  cliente_nombre: string;
  numero_documento: string;
  tipo_documento_codigo: string;
  segmento_nombre: string;
  moneda_codigo: string;
  moneda_simbolo: string;
}

export interface MovimientoCuenta {
  id_movimiento: number;
  id_cuenta: number;
  id_tipo_movimiento: number;
  tipo_codigo: string;
  tipo_nombre: string;
  naturaleza: 'C' | 'A';
  estado_codigo: string;
  estado_nombre: string;
  numero_documento_ref: string | null;
  fecha_movimiento: string;
  fecha_vencimiento: string | null;
  monto: string;
  monto_aplicado: string;
  saldo_pendiente: string;
  saldo_calculado?: string;
  glosa: string;
  usuario_registro?: string;
}

export interface AlertaCredito {
  id_alerta: number;
  id_cuenta: number;
  tipo_alerta: 'EXCESO_LINEA' | 'PROXIMO_LIMITE';
  linea_credito_momento: string;
  saldo_momento: string;
  monto_excedido: string;
  mensaje: string;
  estado: 'ACTIVA' | 'REVISADA' | 'RESUELTA';
  fecha_generacion: string;
  fecha_resolucion: string | null;
  numero_cuenta: string;
  cliente_nombre: string;
  moneda_simbolo: string;
}

export interface InteraccionCliente {
  id_interaccion: number;
  id_cliente: number;
  cliente_nombre: string;
  tipo_codigo: string;
  tipo_nombre: string;
  usuario_nombre: string;
  fecha_interaccion: string;
  asunto: string;
  detalle: string;
  resultado: string | null;
  fecha_proximo_seguimiento: string | null;
}

export interface ConciliacionCuenta {
  id_conciliacion: number;
  id_cuenta: number;
  numero_cuenta: string;
  cliente_nombre: string;
  moneda_simbolo: string;
  fecha_inicio: string;
  fecha_fin: string;
  saldo_inicial_sistema: string;
  total_cargos_sistema: string;
  total_abonos_sistema: string;
  saldo_final_sistema: string;
  saldo_inicial_manual: string;
  total_cargos_manual: string;
  total_abonos_manual: string;
  saldo_final_manual: string;
  diferencia_saldo: string;
  estado: 'CONCILIADO' | 'CON_DIFERENCIA';
  observaciones: string | null;
  usuario_concilia: string;
  fecha_conciliacion: string;
}
