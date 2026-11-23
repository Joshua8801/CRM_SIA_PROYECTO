-- ============================================================================
-- CRM DE CUENTAS CORRIENTES - TEMA T3
-- Script 04: Migración de restricción de conciliación para bases existentes
-- Objetivo:
--   1. Eliminar la restricción anterior chk_trs_concil_estado_coherente
--      antes de reclasificar filas con diferencias compensadas.
--   2. Reclasificar conciliaciones antiguas marcadas como CONCILIADO que
--      presenten diferencias compensadas en saldo inicial, cargos o abonos,
--      conservando intactos todos los importes históricos guardados.
--   3. Crear la nueva restricción chk_trs_concil_estado_coherente exigiendo
--      coincidencia exacta en los cuatro importes.
-- ============================================================================

BEGIN;

-- 1. Eliminar restricción anterior para permitir la reclasificación
ALTER TABLE trs_conciliacion_cuenta
    DROP CONSTRAINT IF EXISTS chk_trs_concil_estado_coherente;

-- 2. Reclasificar conciliaciones con diferencias compensadas sin alterar importes
UPDATE trs_conciliacion_cuenta
SET estado = 'CON_DIFERENCIA'
WHERE estado = 'CONCILIADO'
  AND (
      saldo_inicial_sistema <> saldo_inicial_manual
      OR total_cargos_sistema  <> total_cargos_manual
      OR total_abonos_sistema  <> total_abonos_manual
      OR saldo_final_sistema   <> saldo_final_manual
  );

-- 3. Agregar nueva restricción CHECK de coherencia sobre los 4 importes
ALTER TABLE trs_conciliacion_cuenta
    ADD CONSTRAINT chk_trs_concil_estado_coherente CHECK (
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
    );

COMMIT;
