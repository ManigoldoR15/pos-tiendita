-- =============================================================================
-- 076_max_cajas_default_3.sql — los negocios nuevos nacen con 3 cajas
--
-- Compañera obligada de la 074 (max_plazas default 3): una plaza sin su propia
-- caja rompe la promesa de "el dinero de cada caja es independiente". Con
-- max_cajas = 1, la segunda plaza no podía abrir caja mientras la primera
-- tuviera la suya abierta ("Límite de cajas alcanzado").
--
-- Igual que la 074: solo cambia el default. Los negocios existentes conservan
-- su límite y se ajustan desde el panel de superadmin (actualizar_licencia_cajas).
-- =============================================================================

ALTER TABLE negocios
  ALTER COLUMN max_cajas SET DEFAULT 3;

COMMENT ON COLUMN negocios.max_cajas IS
  'Máximo de cajas abiertas a la vez permitidas por la licencia. Nace en 3 para '
  'que cada plaza de un negocio nuevo pueda operar su propia caja sin intervención '
  'del superadmin. Solo el superadmin puede cambiarlo después.';
