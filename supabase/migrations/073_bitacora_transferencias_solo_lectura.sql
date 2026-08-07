-- =============================================================================
-- 073_bitacora_transferencias_solo_lectura.sql
--
-- transferencias_inventario nace con los grants por defecto de Supabase, que dan
-- INSERT/UPDATE/DELETE a authenticated. Hoy la RLS ya los frena (la tabla solo
-- tiene política de SELECT), pero la bitácora debe ser inmutable de verdad:
-- si una migración futura tocara la RLS por error, quedaría editable.
--
-- Mismo criterio de defensa en profundidad que 067_harden_grants_tablas.sql.
-- La escritura sigue ocurriendo dentro de transferir_stock_plaza(), que es
-- SECURITY DEFINER y no pasa por estos grants.
-- =============================================================================

REVOKE INSERT, UPDATE, DELETE ON transferencias_inventario FROM authenticated;
