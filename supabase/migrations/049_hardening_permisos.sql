-- =============================================================================
-- 049_hardening_permisos.sql — Cierre de permisos de ejecución (advisors)
--
-- Problema: Postgres otorga EXECUTE a PUBLIC por default en cada función →
-- las 51 funciones SECURITY DEFINER eran ejecutables por `anon` (sin login)
-- vía /rest/v1/rpc/*. Aunque casi todas validan permisos por dentro, esto
-- expone superficie innecesaria (p.ej. buscar_usuario_por_email permitía
-- enumerar correos sin sesión; log_acceso aceptaba escribir bitácora ajena).
--
-- Cambios:
--   1. REVOKE EXECUTE de PUBLIC y anon en TODAS las funciones de public,
--      y en los futuros defaults.
--   2. GRANT a authenticated (las funciones validan por dentro con auth.uid()).
--   3. Excepciones más estrictas:
--        - log_acceso: solo service_role (la llama el proxy con service key).
--        - funciones de trigger: sin EXECUTE directo para nadie.
--   4. actualizar_updated_at: fijar search_path (advisor).
--   5. pg_trgm: mover de public al esquema extensions (advisor).
-- =============================================================================

-- ─── 1. Revocar acceso público/anónimo a todas las funciones ─────────────────

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ─── 2. Los usuarios autenticados conservan acceso (validación interna) ──────

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ─── 3. Excepciones estrictas ────────────────────────────────────────────────

-- log_acceso: solo el proxy (service_role). Un usuario autenticado no debe
-- poder escribir bitácora de otro user_id.
REVOKE EXECUTE ON FUNCTION log_acceso(uuid, text, date, text, text) FROM authenticated;

-- Funciones de trigger: nunca se llaman por RPC.
REVOKE EXECUTE ON FUNCTION actualizar_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION sync_existencias_producto() FROM authenticated;
REVOKE EXECUTE ON FUNCTION proteger_lista_negra_clientes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION check_max_cajas() FROM authenticated;
REVOKE EXECUTE ON FUNCTION check_max_empleados() FROM authenticated;

-- ─── 4. search_path fijo en actualizar_updated_at ────────────────────────────

ALTER FUNCTION actualizar_updated_at() SET search_path = public;

-- ─── 5. pg_trgm fuera de public ──────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated, service_role;
