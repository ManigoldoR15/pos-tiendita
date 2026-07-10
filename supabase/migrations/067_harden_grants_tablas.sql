-- =============================================================================
-- 067_harden_grants_tablas.sql — defensa en profundidad en grants de tabla
--
-- anon (visitante sin sesión) no necesita NINGÚN privilegio de tabla — la app
-- pública (login, /inicio, tema estacional del layout raíz) usa service_role o
-- sesión authenticated. Hoy la RLS ya lo frena, pero si una futura migración
-- deshabilitara RLS en una tabla por error, esto evita la exposición.
-- authenticated tampoco necesita TRUNCATE (¡no pasa por RLS!), TRIGGER ni
-- REFERENCES vía PostgREST.
-- Verificado tras aplicar: REST como anon → 42501 en todas las tablas; suite
-- E2E completa en verde (authenticated conserva SELECT/INSERT/UPDATE/DELETE).
-- =============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA public FROM anon;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Que las tablas futuras nazcan igual (las migraciones corren como postgres):
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;
