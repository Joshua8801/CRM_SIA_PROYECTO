BEGIN;

LOCK TABLE trs_movimiento_cuenta IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    tipos_comprobante TEXT;
    estado_anulado INT;
    conflictos JSONB;
BEGIN
    -- Resolver las identidades por código para instalaciones y datos ya existentes.
    SELECT string_agg(id_tipo_movimiento::text, ', ' ORDER BY id_tipo_movimiento)
    INTO tipos_comprobante
    FROM tipo_movimiento_cuenta
    WHERE codigo IN ('CARGO_FACTURA', 'CARGO_NOTA_DEB', 'ABONO_NOTA_CRED');

    SELECT id_estado_movimiento INTO estado_anulado
    FROM tipo_estado_movimiento WHERE codigo = 'ANULADO';

    IF COALESCE(array_length(string_to_array(tipos_comprobante, ', '), 1), 0) <> 3
       OR estado_anulado IS NULL THEN
        RAISE EXCEPTION 'No se encontraron los tipos de comprobante y el estado ANULADO.';
    END IF;

    SELECT jsonb_agg(to_jsonb(duplicado))
    INTO conflictos
    FROM (
        SELECT m.id_cuenta, t.codigo AS tipo,
               upper(regexp_replace(m.numero_documento_ref, '[[:space:]]+', '', 'g')) AS documento,
               array_agg(m.id_movimiento ORDER BY m.id_movimiento) AS movimientos
        FROM trs_movimiento_cuenta AS m
        JOIN tipo_movimiento_cuenta AS t USING (id_tipo_movimiento)
        WHERE t.codigo IN ('CARGO_FACTURA', 'CARGO_NOTA_DEB', 'ABONO_NOTA_CRED')
          AND m.id_estado_movimiento <> estado_anulado
          AND m.numero_documento_ref IS NOT NULL
        GROUP BY m.id_cuenta, t.codigo, 3
        HAVING COUNT(*) > 1
    ) AS duplicado;

    IF conflictos IS NOT NULL THEN
        RAISE EXCEPTION 'Hay comprobantes vigentes duplicados. Revise los movimientos antes de continuar.'
            USING DETAIL = conflictos::text;
    END IF;

    EXECUTE format(
        $indice$
        CREATE UNIQUE INDEX IF NOT EXISTS uq_trs_comprobante_vigente
            ON trs_movimiento_cuenta (
                id_cuenta, id_tipo_movimiento,
                upper(regexp_replace(numero_documento_ref, '[[:space:]]+', '', 'g'))
            )
            WHERE id_estado_movimiento <> %s
              AND id_tipo_movimiento IN (%s)
              AND numero_documento_ref IS NOT NULL
        $indice$, estado_anulado, tipos_comprobante
    );
END $$;

COMMIT;
