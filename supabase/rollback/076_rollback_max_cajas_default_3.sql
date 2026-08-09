-- Rollback de 076_max_cajas_default_3.sql
--
-- Devuelve el default a 1 (valor original de la migración 039). No toca los
-- negocios ya creados: bajar el límite de uno concreto es decisión de licencia
-- y se hace con actualizar_licencia_cajas(), que valida que no queden más
-- cajas abiertas que el nuevo tope.

ALTER TABLE negocios
  ALTER COLUMN max_cajas SET DEFAULT 1;

COMMENT ON COLUMN negocios.max_cajas IS
  'Máximo de cajas abiertas simultáneamente permitidas por la licencia (control del superadmin).';
