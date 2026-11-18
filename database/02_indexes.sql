-- ============================================================================
-- CRM DE CUENTAS CORRIENTES - TEMA T3
-- Script 02: Índices de Rendimiento e Integridad Parcial
-- Motor objetivo: PostgreSQL 17+
-- ============================================================================

-- Clientes: búsquedas por segmento y nombre/razón social
CREATE INDEX idx_mae_cliente_segmento
    ON mae_cliente (id_segmento);

CREATE INDEX idx_mae_cliente_nombre_display
    ON mae_cliente (COALESCE(razon_social, nombre_completo));

-- Cuentas corrientes: consulta por cliente
CREATE INDEX idx_mae_cuenta_cliente
    ON mae_cuenta_corriente (id_cliente);

-- Movimientos: estado de cuenta por rango de fechas y cálculo de saldo
CREATE INDEX idx_trs_mov_cuenta_fecha
    ON trs_movimiento_cuenta (id_cuenta, fecha_movimiento DESC, id_movimiento DESC);

CREATE INDEX idx_trs_mov_estado
    ON trs_movimiento_cuenta (id_estado_movimiento);

-- Aplicación de pagos: consulta por cargo y por abono
CREATE INDEX idx_trs_apli_cargo
    ON trs_aplicacion_pago (id_movimiento_cargo);

CREATE INDEX idx_trs_apli_abono
    ON trs_aplicacion_pago (id_movimiento_abono);

-- Alertas de crédito: bandeja por cuenta/estado y unicidad de alerta activa por tipo
CREATE INDEX idx_trs_alerta_cuenta_estado
    ON trs_alerta_credito (id_cuenta, estado);

CREATE UNIQUE INDEX uq_trs_alerta_activa_unica
    ON trs_alerta_credito (id_cuenta, tipo_alerta)
    WHERE estado = 'ACTIVA';

-- Interacciones: historial cronológico por cliente
CREATE INDEX idx_trs_interaccion_cliente_fecha
    ON trs_interaccion_cliente (id_cliente, fecha_interaccion DESC);

-- Conciliaciones: historial por cuenta y período
CREATE INDEX idx_trs_conciliacion_cuenta_periodo
    ON trs_conciliacion_cuenta (id_cuenta, fecha_inicio, fecha_fin);

-- Auditoría: consultas por tabla y fecha
CREATE INDEX idx_trs_auditoria_tabla_fecha
    ON trs_auditoria (tabla_afectada, fecha_evento DESC);
