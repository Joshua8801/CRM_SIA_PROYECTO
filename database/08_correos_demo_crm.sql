-- ============================================================================
-- CRM DE CUENTAS CORRIENTES
-- Script 08: Actualización idempotente de correos de demostración
-- Objetivo:
--   Actualizar únicamente las dos cuentas de demostración:
--     admin@crm-t3.edu    -> admin@crm.example
--     analista@crm-t3.edu -> analista@crm.example
--   conservando sus IDs, roles y contraseñas.
--   Si el correo de destino ya pertenece a otro usuario, detiene la migración.
-- ============================================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM mae_usuario WHERE LOWER(email) = 'admin@crm-t3.edu') THEN
        IF EXISTS (SELECT 1 FROM mae_usuario WHERE LOWER(email) = 'admin@crm.example') THEN
            RAISE EXCEPTION 'Conflicto de migración: el correo admin@crm.example ya pertenece a otro usuario.';
        END IF;

        UPDATE mae_usuario
        SET email = 'admin@crm.example',
            fecha_actualizacion = NOW()
        WHERE LOWER(email) = 'admin@crm-t3.edu';
    END IF;

    IF EXISTS (SELECT 1 FROM mae_usuario WHERE LOWER(email) = 'analista@crm-t3.edu') THEN
        IF EXISTS (SELECT 1 FROM mae_usuario WHERE LOWER(email) = 'analista@crm.example') THEN
            RAISE EXCEPTION 'Conflicto de migración: el correo analista@crm.example ya pertenece a otro usuario.';
        END IF;

        UPDATE mae_usuario
        SET email = 'analista@crm.example',
            fecha_actualizacion = NOW()
        WHERE LOWER(email) = 'analista@crm-t3.edu';
    END IF;
END $$;

COMMIT;
