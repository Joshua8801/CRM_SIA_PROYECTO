-- ============================================================================
-- CRM DE CUENTAS CORRIENTES - TEMA T3
-- Script 07: Gestión de Cobranza y Compromisos de Pago
-- Tablas: trs_gestion_cobranza, trs_compromiso_pago
-- Vinculación: trs_interaccion_cliente.id_gestion
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS trs_gestion_cobranza (
    id_gestion             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cuenta              INT NOT NULL REFERENCES mae_cuenta_corriente(id_cuenta),
    id_usuario_responsable INT NOT NULL REFERENCES mae_usuario(id_usuario),
    motivo                 VARCHAR(200) NOT NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ABIERTA'
                           CHECK (estado IN ('ABIERTA', 'CERRADA')),
    observaciones_cierre   TEXT NULL,
    fecha_apertura         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre           TIMESTAMPTZ NULL,
    id_usuario_registro    INT NOT NULL REFERENCES mae_usuario(id_usuario),
    CONSTRAINT chk_trs_gestion_cierre CHECK (
        (estado = 'ABIERTA' AND fecha_cierre IS NULL)
        OR
        (estado = 'CERRADA' AND fecha_cierre IS NOT NULL)
    )
);

ALTER TABLE trs_interaccion_cliente
    ADD COLUMN IF NOT EXISTS id_gestion INT NULL REFERENCES trs_gestion_cobranza(id_gestion);

CREATE TABLE IF NOT EXISTS trs_compromiso_pago (
    id_compromiso       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_gestion          INT NOT NULL REFERENCES trs_gestion_cobranza(id_gestion),
    fecha_pactada       DATE NOT NULL,
    monto_comprometido  NUMERIC(14,2) NOT NULL CHECK (monto_comprometido > 0),
    estado              VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
                        CHECK (estado IN ('PENDIENTE', 'CUMPLIDO', 'INCUMPLIDO', 'CANCELADO')),
    observacion         TEXT NULL,
    id_movimiento_abono INT NULL REFERENCES trs_movimiento_cuenta(id_movimiento),
    fecha_registro      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    id_usuario_registro INT NOT NULL REFERENCES mae_usuario(id_usuario),
    CONSTRAINT uq_trs_compromiso_abono UNIQUE (id_movimiento_abono),
    CONSTRAINT chk_trs_compromiso_cumplido_abono CHECK (
        estado <> 'CUMPLIDO' OR id_movimiento_abono IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_trs_gestion_cuenta_estado
    ON trs_gestion_cobranza (id_cuenta, estado, fecha_apertura DESC);

CREATE INDEX IF NOT EXISTS idx_trs_compromiso_gestion_estado
    ON trs_compromiso_pago (id_gestion, estado, fecha_pactada);

CREATE INDEX IF NOT EXISTS idx_trs_interaccion_gestion
    ON trs_interaccion_cliente (id_gestion)
    WHERE id_gestion IS NOT NULL;

COMMIT;
