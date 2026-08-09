-- Rollback de 074_max_plazas_default_3.sql
--
-- Devuelve el default a 1 (el valor original de la migración 030). No toca los
-- negocios ya creados: los que nacieron con 3 conservan su límite, bajarlo es
-- decisión de licencia y se hace desde el panel de superadmin, que además
-- valida que no queden plazas activas por encima del nuevo tope.

ALTER TABLE negocios
  ALTER COLUMN max_plazas SET DEFAULT 1;

COMMENT ON COLUMN negocios.max_plazas IS
  'Máximo de plazas activas permitidas por la licencia (control del superadmin).';
