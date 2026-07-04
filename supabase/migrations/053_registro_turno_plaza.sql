-- =============================================================================
-- 053_registro_turno_plaza.sql — El registro de turno guarda la plaza
--
-- La plaza del empleado se congela al marcar entrada: si después lo rotan a
-- otra plaza, su historial de turnos sigue mostrando dónde trabajó ese día.
-- Backfill best-effort con la asignación actual.
-- =============================================================================

ALTER TABLE registros_turno
  ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES locales(id) ON DELETE SET NULL;

COMMENT ON COLUMN registros_turno.local_id IS
  'Plaza asignada al empleado al momento de marcar entrada (histórico exacto).';

UPDATE registros_turno r
SET local_id = un.local_id
FROM usuarios_negocio un
WHERE un.user_id = r.user_id
  AND un.negocio_id = r.negocio_id
  AND r.local_id IS NULL
  AND un.local_id IS NOT NULL;
