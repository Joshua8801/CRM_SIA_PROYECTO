-- ============================================================================
-- CRM DE CUENTAS CORRIENTES - TEMA T3
-- Script 01: Definición de Esquema Relacional (15 Tablas + Vistas + Funciones)
-- Motor objetivo: PostgreSQL 17+
-- ============================================================================

-- ============================================================================
-- 1. TABLAS DE CATÁLOGO (6)
-- ============================================================================

CREATE TABLE tipo_documento (
    id_tipo_documento INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo            VARCHAR(10) NOT NULL UNIQUE,
    nombre            VARCHAR(50) NOT NULL,
    longitud_exacta   SMALLINT NULL CHECK (longitud_exacta IS NULL OR longitud_exacta > 0),
    activo            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tipo_moneda (
    id_tipo_moneda    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo            CHAR(3) NOT NULL UNIQUE,
    nombre            VARCHAR(40) NOT NULL,
    simbolo           VARCHAR(5) NOT NULL,
    activo            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cat_segmento_cliente (
    id_segmento            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo                 VARCHAR(20) NOT NULL UNIQUE,
    nombre                 VARCHAR(60) NOT NULL,
    descripcion            VARCHAR(200) NULL,
    linea_credito_sugerida NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (linea_credito_sugerida >= 0),
    dias_plazo_defecto     SMALLINT NOT NULL DEFAULT 30 CHECK (dias_plazo_defecto >= 0),
    activo                 BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tipo_movimiento_cuenta (
    id_tipo_movimiento   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo               VARCHAR(20) NOT NULL UNIQUE,
    nombre               VARCHAR(60) NOT NULL,
    naturaleza           CHAR(1) NOT NULL CHECK (naturaleza IN ('C', 'A')), -- C: Cargo (+deuda), A: Abono (-deuda)
    requiere_vencimiento BOOLEAN NOT NULL DEFAULT FALSE,
    activo               BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tipo_interaccion (
    id_tipo_interaccion  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo               VARCHAR(20) NOT NULL UNIQUE,
    nombre               VARCHAR(50) NOT NULL,
    activo               BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tipo_estado_movimiento (
    id_estado_movimiento INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo               VARCHAR(20) NOT NULL UNIQUE,
    nombre               VARCHAR(50) NOT NULL,
    es_final             BOOLEAN NOT NULL DEFAULT FALSE,
    activo               BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================================
-- 2. TABLAS MAESTRAS (3)
-- ============================================================================

CREATE TABLE mae_usuario (
    id_usuario          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_completo     VARCHAR(120) NOT NULL,
    email               VARCHAR(120) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    rol                 VARCHAR(20) NOT NULL DEFAULT 'ANALISTA'
                        CHECK (rol IN ('ADMIN', 'ANALISTA', 'CONSULTA')),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mae_cliente (
    id_cliente          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_persona        VARCHAR(10) NOT NULL CHECK (tipo_persona IN ('NATURAL', 'JURIDICA')),
    id_tipo_documento   INT NOT NULL REFERENCES tipo_documento(id_tipo_documento),
    numero_documento    VARCHAR(20) NOT NULL,
    nombre_completo     VARCHAR(150) NULL, -- Obligatorio para NATURAL
    razon_social        VARCHAR(150) NULL, -- Obligatorio para JURIDICA
    nombre_comercial    VARCHAR(150) NULL,
    id_segmento         INT NOT NULL REFERENCES cat_segmento_cliente(id_segmento),
    email               VARCHAR(120) NULL,
    telefono            VARCHAR(30) NULL,
    direccion           VARCHAR(250) NULL,
    estado              VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
                        CHECK (estado IN ('ACTIVO', 'BLOQUEADO', 'INACTIVO')),
    id_usuario_registro INT NOT NULL REFERENCES mae_usuario(id_usuario),
    fecha_registro      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mae_cliente_documento UNIQUE (id_tipo_documento, numero_documento),
    CONSTRAINT chk_mae_cliente_tipo_persona CHECK (
        (tipo_persona = 'NATURAL'  AND nombre_completo IS NOT NULL AND LENGTH(TRIM(nombre_completo)) > 0 AND razon_social IS NULL)
        OR
        (tipo_persona = 'JURIDICA' AND razon_social IS NOT NULL AND LENGTH(TRIM(razon_social)) > 0 AND nombre_completo IS NULL)
    )
);

CREATE TABLE mae_cuenta_corriente (
    id_cuenta           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente          INT NOT NULL REFERENCES mae_cliente(id_cliente),
    id_tipo_moneda      INT NOT NULL REFERENCES tipo_moneda(id_tipo_moneda),
    numero_cuenta       VARCHAR(30) NOT NULL UNIQUE,
    linea_credito       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (linea_credito >= 0),
    estado              VARCHAR(20) NOT NULL DEFAULT 'ACTIVA'
                        CHECK (estado IN ('ACTIVA', 'SUSPENDIDA', 'CERRADA')),
    fecha_apertura      DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mae_cuenta_cliente_moneda UNIQUE (id_cliente, id_tipo_moneda)
);

-- ============================================================================
-- 3. TABLAS TRANSACCIONALES (6)
-- ============================================================================

CREATE TABLE trs_movimiento_cuenta (
    id_movimiento        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cuenta            INT NOT NULL REFERENCES mae_cuenta_corriente(id_cuenta),
    id_tipo_movimiento   INT NOT NULL REFERENCES tipo_movimiento_cuenta(id_tipo_movimiento),
    id_estado_movimiento INT NOT NULL REFERENCES tipo_estado_movimiento(id_estado_movimiento),
    numero_documento_ref VARCHAR(40) NULL,
    fecha_movimiento     DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento    DATE NULL,
    monto                NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    glosa                VARCHAR(250) NOT NULL,
    id_usuario_registro  INT NOT NULL REFERENCES mae_usuario(id_usuario),
    fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_trs_mov_fechas CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_movimiento)
);

CREATE TABLE trs_aplicacion_pago (
    id_aplicacion       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_movimiento_abono INT NOT NULL REFERENCES trs_movimiento_cuenta(id_movimiento),
    id_movimiento_cargo INT NOT NULL REFERENCES trs_movimiento_cuenta(id_movimiento),
    monto_aplicado      NUMERIC(14,2) NOT NULL CHECK (monto_aplicado > 0),
    fecha_aplicacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    id_usuario_registro INT NOT NULL REFERENCES mae_usuario(id_usuario),
    CONSTRAINT chk_trs_apli_distintos CHECK (id_movimiento_abono <> id_movimiento_cargo),
    CONSTRAINT uq_trs_apli_abono_cargo UNIQUE (id_movimiento_abono, id_movimiento_cargo)
);

CREATE TABLE trs_alerta_credito (
    id_alerta             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cuenta             INT NOT NULL REFERENCES mae_cuenta_corriente(id_cuenta),
    id_movimiento_origen  INT NULL REFERENCES trs_movimiento_cuenta(id_movimiento),
    tipo_alerta           VARCHAR(30) NOT NULL
                          CHECK (tipo_alerta IN ('EXCESO_LINEA', 'PROXIMO_LIMITE')),
    linea_credito_momento NUMERIC(14,2) NOT NULL CHECK (linea_credito_momento >= 0),
    saldo_momento         NUMERIC(14,2) NOT NULL,
    monto_excedido        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monto_excedido >= 0),
    mensaje               VARCHAR(250) NOT NULL,
    estado                VARCHAR(20) NOT NULL DEFAULT 'ACTIVA'
                          CHECK (estado IN ('ACTIVA', 'REVISADA', 'RESUELTA')),
    fecha_generacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_resolucion      TIMESTAMPTZ NULL,
    id_usuario_resolucion INT NULL REFERENCES mae_usuario(id_usuario)
);

CREATE TABLE trs_interaccion_cliente (
    id_interaccion            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente                INT NOT NULL REFERENCES mae_cliente(id_cliente),
    id_tipo_interaccion       INT NOT NULL REFERENCES tipo_interaccion(id_tipo_interaccion),
    id_usuario                INT NOT NULL REFERENCES mae_usuario(id_usuario),
    fecha_interaccion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    asunto                    VARCHAR(120) NOT NULL,
    detalle                   TEXT NOT NULL,
    resultado                 VARCHAR(80) NULL,
    fecha_proximo_seguimiento DATE NULL
);

CREATE TABLE trs_gestion_cobranza (
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
    ADD COLUMN id_gestion INT NULL REFERENCES trs_gestion_cobranza(id_gestion);

CREATE TABLE trs_compromiso_pago (
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

CREATE TABLE trs_conciliacion_cuenta (
    id_conciliacion       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cuenta             INT NOT NULL REFERENCES mae_cuenta_corriente(id_cuenta),
    fecha_inicio          DATE NOT NULL,
    fecha_fin             DATE NOT NULL,
    saldo_inicial_sistema NUMERIC(14,2) NOT NULL,
    total_cargos_sistema  NUMERIC(14,2) NOT NULL CHECK (total_cargos_sistema >= 0),
    total_abonos_sistema  NUMERIC(14,2) NOT NULL CHECK (total_abonos_sistema >= 0),
    saldo_final_sistema   NUMERIC(14,2) NOT NULL,
    saldo_inicial_manual  NUMERIC(14,2) NOT NULL,
    total_cargos_manual   NUMERIC(14,2) NOT NULL CHECK (total_cargos_manual >= 0),
    total_abonos_manual   NUMERIC(14,2) NOT NULL CHECK (total_abonos_manual >= 0),
    saldo_final_manual    NUMERIC(14,2) NOT NULL,
    diferencia_saldo      NUMERIC(14,2) GENERATED ALWAYS AS (saldo_final_sistema - saldo_final_manual) STORED,
    estado                VARCHAR(20) NOT NULL CHECK (estado IN ('CONCILIADO', 'CON_DIFERENCIA')),
    observaciones         TEXT NULL,
    id_usuario_concilia   INT NOT NULL REFERENCES mae_usuario(id_usuario),
    fecha_conciliacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_trs_concil_periodo CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_trs_concil_coherencia_sistema CHECK (
        saldo_final_sistema = ROUND((saldo_inicial_sistema + total_cargos_sistema - total_abonos_sistema)::numeric, 2)
    ),
    CONSTRAINT chk_trs_concil_coherencia_manual CHECK (
        saldo_final_manual = ROUND((saldo_inicial_manual + total_cargos_manual - total_abonos_manual)::numeric, 2)
    ),
    CONSTRAINT chk_trs_concil_estado_coherente CHECK (
        (
            estado = 'CONCILIADO'
            AND saldo_inicial_sistema = saldo_inicial_manual
            AND total_cargos_sistema  = total_cargos_manual
            AND total_abonos_sistema  = total_abonos_manual
            AND saldo_final_sistema   = saldo_final_manual
        )
        OR
        (
            estado = 'CON_DIFERENCIA'
            AND (
                saldo_inicial_sistema <> saldo_inicial_manual
                OR total_cargos_sistema  <> total_cargos_manual
                OR total_abonos_sistema  <> total_abonos_manual
                OR saldo_final_sistema   <> saldo_final_manual
            )
        )
    )
);

CREATE TABLE trs_auditoria (
    id_auditoria     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabla_afectada   VARCHAR(60) NOT NULL,
    id_registro      VARCHAR(40) NOT NULL,
    accion           VARCHAR(20) NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE', 'ANULACION')),
    datos_anteriores JSONB NULL,
    datos_nuevos     JSONB NULL,
    id_usuario       INT NULL REFERENCES mae_usuario(id_usuario),
    fecha_evento     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. PROTECCIÓN DE AUDITORÍA (INMUTABILIDAD DE trs_auditoria)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_proteger_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'La tabla trs_auditoria es de solo lectura histórica; no se permiten modificaciones ni eliminaciones.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proteger_auditoria
    BEFORE UPDATE OR DELETE ON trs_auditoria
    FOR EACH ROW
    EXECUTE FUNCTION fn_proteger_auditoria();

-- ============================================================================
-- 5. VISTAS Y FUNCIONES DE CÁLCULO FINANCIERO (SIN REDUNDANCIA DE SALDOS)
-- ============================================================================

-- Vista de detalle y saldo pendiente por movimiento (cargo o abono)
CREATE OR REPLACE VIEW vw_movimiento_saldo AS
SELECT
    m.id_movimiento,
    m.id_cuenta,
    m.id_tipo_movimiento,
    tmv.codigo AS tipo_codigo,
    tmv.nombre AS tipo_nombre,
    tmv.naturaleza,
    m.id_estado_movimiento,
    est.codigo AS estado_codigo,
    est.nombre AS estado_nombre,
    m.numero_documento_ref,
    m.fecha_movimiento,
    m.fecha_vencimiento,
    m.monto,
    m.glosa,
    m.id_usuario_registro,
    m.fecha_registro,
    COALESCE(
        CASE
            WHEN tmv.naturaleza = 'C' THEN (
                SELECT SUM(ap.monto_aplicado)
                FROM trs_aplicacion_pago ap
                WHERE ap.id_movimiento_cargo = m.id_movimiento
            )
            ELSE (
                SELECT SUM(ap.monto_aplicado)
                FROM trs_aplicacion_pago ap
                WHERE ap.id_movimiento_abono = m.id_movimiento
            )
        END,
        0
    )::NUMERIC(14,2) AS monto_aplicado,
    CASE
        WHEN est.codigo = 'ANULADO' THEN 0.00
        ELSE (
            m.monto - COALESCE(
                CASE
                    WHEN tmv.naturaleza = 'C' THEN (
                        SELECT SUM(ap.monto_aplicado)
                        FROM trs_aplicacion_pago ap
                        WHERE ap.id_movimiento_cargo = m.id_movimiento
                    )
                    ELSE (
                        SELECT SUM(ap.monto_aplicado)
                        FROM trs_aplicacion_pago ap
                        WHERE ap.id_movimiento_abono = m.id_movimiento
                    )
                END,
                0
            )
        )
    END::NUMERIC(14,2) AS saldo_pendiente
FROM trs_movimiento_cuenta m
JOIN tipo_movimiento_cuenta tmv ON tmv.id_tipo_movimiento = m.id_tipo_movimiento
JOIN tipo_estado_movimiento est ON est.id_estado_movimiento = m.id_estado_movimiento;

-- Vista de saldo actual, total de cargos y total de abonos por cuenta corriente
CREATE OR REPLACE VIEW vw_cuenta_saldo AS
SELECT
    cc.id_cuenta,
    cc.id_cliente,
    cc.id_tipo_moneda,
    cc.numero_cuenta,
    cc.linea_credito,
    cc.estado,
    cc.fecha_apertura,
    cc.fecha_actualizacion,
    COALESCE(SUM(
        CASE WHEN est.codigo <> 'ANULADO' AND tmv.naturaleza = 'C' THEN m.monto ELSE 0 END
    ), 0)::NUMERIC(14,2) AS total_cargos,
    COALESCE(SUM(
        CASE WHEN est.codigo <> 'ANULADO' AND tmv.naturaleza = 'A' THEN m.monto ELSE 0 END
    ), 0)::NUMERIC(14,2) AS total_abonos,
    COALESCE(SUM(
        CASE
            WHEN est.codigo <> 'ANULADO' AND tmv.naturaleza = 'C' THEN m.monto
            WHEN est.codigo <> 'ANULADO' AND tmv.naturaleza = 'A' THEN -m.monto
            ELSE 0
        END
    ), 0)::NUMERIC(14,2) AS saldo_actual,
    (
        cc.linea_credito - COALESCE(SUM(
            CASE
                WHEN est.codigo <> 'ANULADO' AND tmv.naturaleza = 'C' THEN m.monto
                WHEN est.codigo <> 'ANULADO' AND tmv.naturaleza = 'A' THEN -m.monto
                ELSE 0
            END
        ), 0)
    )::NUMERIC(14,2) AS credito_disponible,
    (
        COALESCE(SUM(
            CASE
                WHEN est.codigo <> 'ANULADO' AND tmv.naturaleza = 'C' THEN m.monto
                WHEN est.codigo <> 'ANULADO' AND tmv.naturaleza = 'A' THEN -m.monto
                ELSE 0
            END
        ), 0) > cc.linea_credito
    ) AS excede_linea
FROM mae_cuenta_corriente cc
LEFT JOIN trs_movimiento_cuenta m ON m.id_cuenta = cc.id_cuenta
LEFT JOIN tipo_movimiento_cuenta tmv ON tmv.id_tipo_movimiento = m.id_tipo_movimiento
LEFT JOIN tipo_estado_movimiento est ON est.id_estado_movimiento = m.id_estado_movimiento
GROUP BY cc.id_cuenta;

-- Función para calcular saldo inicial, cargos, abonos y saldo final de un período
CREATE OR REPLACE FUNCTION fn_resumen_periodo_cuenta(
    p_id_cuenta INT,
    p_fecha_inicio DATE,
    p_fecha_fin DATE
)
RETURNS TABLE (
    saldo_inicial NUMERIC(14,2),
    total_cargos  NUMERIC(14,2),
    total_abonos  NUMERIC(14,2),
    saldo_final   NUMERIC(14,2)
) AS $$
DECLARE
    v_saldo_ini NUMERIC(14,2);
    v_cargos    NUMERIC(14,2);
    v_abonos    NUMERIC(14,2);
BEGIN
    SELECT COALESCE(SUM(
        CASE WHEN tmv.naturaleza = 'C' THEN m.monto ELSE -m.monto END
    ), 0)::NUMERIC(14,2)
    INTO v_saldo_ini
    FROM trs_movimiento_cuenta m
    JOIN tipo_movimiento_cuenta tmv ON tmv.id_tipo_movimiento = m.id_tipo_movimiento
    JOIN tipo_estado_movimiento est ON est.id_estado_movimiento = m.id_estado_movimiento
    WHERE m.id_cuenta = p_id_cuenta
      AND m.fecha_movimiento < p_fecha_inicio
      AND est.codigo <> 'ANULADO';

    SELECT
        COALESCE(SUM(CASE WHEN tmv.naturaleza = 'C' THEN m.monto ELSE 0 END), 0)::NUMERIC(14,2),
        COALESCE(SUM(CASE WHEN tmv.naturaleza = 'A' THEN m.monto ELSE 0 END), 0)::NUMERIC(14,2)
    INTO v_cargos, v_abonos
    FROM trs_movimiento_cuenta m
    JOIN tipo_movimiento_cuenta tmv ON tmv.id_tipo_movimiento = m.id_tipo_movimiento
    JOIN tipo_estado_movimiento est ON est.id_estado_movimiento = m.id_estado_movimiento
    WHERE m.id_cuenta = p_id_cuenta
      AND m.fecha_movimiento BETWEEN p_fecha_inicio AND p_fecha_fin
      AND est.codigo <> 'ANULADO';

    RETURN QUERY SELECT
        v_saldo_ini,
        v_cargos,
        v_abonos,
        ROUND((v_saldo_ini + v_cargos - v_abonos)::numeric, 2)::NUMERIC(14,2);
END;
$$ LANGUAGE plpgsql STABLE;
