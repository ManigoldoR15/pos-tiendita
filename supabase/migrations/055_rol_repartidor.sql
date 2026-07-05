-- =============================================================================
-- 055_rol_repartidor.sql — Nuevo rol "repartidor"
--
-- Cuarto valor del enum rol_negocio. Un repartidor NO opera la tienda: solo
-- confirma la carga que un empleado/dueño le entrega y sale a su ruta (GPS del
-- módulo flotilla). Va en su PROPIA migración porque Postgres no permite usar
-- un valor de enum recién agregado dentro de la misma transacción que lo crea.
-- =============================================================================

ALTER TYPE rol_negocio ADD VALUE IF NOT EXISTS 'repartidor';
