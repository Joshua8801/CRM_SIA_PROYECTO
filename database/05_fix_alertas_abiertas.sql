BEGIN;

LOCK TABLE trs_alerta_credito IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    conflictos JSONB;
BEGIN
    SELECT jsonb_agg(to_jsonb(duplicado))
    INTO conflictos
    FROM (
        SELECT id_cuenta, tipo_alerta, array_agg(id_alerta ORDER BY id_alerta) AS alertas
        FROM trs_alerta_credito
        WHERE estado IN ('ACTIVA', 'REVISADA')
        GROUP BY id_cuenta, tipo_alerta
        HAVING COUNT(*) > 1
    ) AS duplicado;

    IF conflictos IS NOT NULL THEN
        RAISE EXCEPTION 'Hay alertas abiertas duplicadas. Regularice sus estados conservando el historial.'
            USING DETAIL = conflictos::text;
    END IF;
END $$;

DROP INDEX IF EXISTS uq_trs_alerta_activa_unica;

CREATE UNIQUE INDEX uq_trs_alerta_activa_unica
    ON trs_alerta_credito (id_cuenta, tipo_alerta)
    WHERE estado IN ('ACTIVA', 'REVISADA');

COMMIT;
