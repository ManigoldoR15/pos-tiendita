-- =============================================================================
-- 074_max_plazas_default_3.sql — los negocios nuevos nacen con 3 plazas
--
-- max_plazas nacía en 1 (migración 030), pensado como control de licencia. En
-- la práctica el dueño da de alta al cliente en persona y el cliente quiere
-- capturar su inventario separado por puesto ese mismo día: con el límite en 1
-- la segunda plaza se rechaza con "Alcanzaste el límite de 1 plaza(s)" en plena
-- venta, y hay que entrar al panel de superadmin a subirlo negocio por negocio.
--
-- Sube el default a 3. No toca negocios existentes: los que ya están en 1 se
-- quedan igual y se ajustan desde el panel, como hasta ahora. Tampoco cambia
-- quién puede modificar el límite — sigue siendo solo el superadmin, vía
-- actualizar_licencia_plazas() y el trigger de 069.
-- =============================================================================

ALTER TABLE negocios
  ALTER COLUMN max_plazas SET DEFAULT 3;

COMMENT ON COLUMN negocios.max_plazas IS
  'Máximo de plazas activas permitidas por la licencia. Nace en 3 para que un '
  'negocio recién dado de alta pueda separar su inventario por puesto sin '
  'intervención del superadmin. Solo el superadmin puede cambiarlo después.';
