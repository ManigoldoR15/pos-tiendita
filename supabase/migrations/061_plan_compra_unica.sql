-- =============================================================================
-- 061_plan_compra_unica.sql
--
-- El modelo de negocio es compra única (POS $15,000 / rastreador $30,000 +
-- $100 por repartidor al mes de mantenimiento), no suscripción mensual.
-- Se agrega el valor 'compra' al plan. Un negocio con plan='compra' y
-- suscripcion_fin NULL cae en estado 'activo' tanto en sa_lista_negocios
-- como en calcEstadoCuenta — sin cambios extra.
-- =============================================================================

ALTER TABLE negocios DROP CONSTRAINT negocios_plan_check;
ALTER TABLE negocios ADD CONSTRAINT negocios_plan_check
  CHECK (plan IN ('prueba', 'mensual', 'anual', 'compra'));
