-- =============================================================================
-- 045_mapa_accesos.sql — Mapa de accesos + actividad del día en superadmin
--
-- Cambios:
--   1. ip_geo: +lat/lon (para pintar usuarios en el mapa). Se vacía la caché
--      para repoblarla con coordenadas.
--   2. negocios: +lat/lon/geo_intentado_en (geocodificación de `ubicacion`).
--   3. log_acceso(): los empleados también quedan ligados a su negocio
--      (antes solo se buscaba rol dueño → empleados salían sin negocio).
--      Backfill de filas existentes sin negocio.
--   4. sa_actividad_dia(): actividad de hoy por usuario (rol, negocio,
--      primera/última vista, visitas, IPs) para las tarjetas y el mapa.
--   5. sa_negocios_mapa(): locales con ubicación/coordenadas para el mapa.
-- =============================================================================

-- ─── 1. ip_geo con coordenadas ───────────────────────────────────────────────

ALTER TABLE ip_geo
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lon double precision;

DELETE FROM ip_geo;  -- repoblar con lat/lon (caché, sin valor histórico)

-- ─── 2. negocios con coordenadas ─────────────────────────────────────────────

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lon double precision,
  ADD COLUMN IF NOT EXISTS geo_intentado_en timestamptz;

COMMENT ON COLUMN negocios.geo_intentado_en IS
  'Última vez que se intentó geocodificar `ubicacion` (Nominatim). NULL = pendiente.';

-- ─── 3. log_acceso: ligar también a empleados con su negocio ─────────────────

CREATE OR REPLACE FUNCTION log_acceso(
  p_user_id    uuid,
  p_email      text    DEFAULT NULL,
  p_fecha      date    DEFAULT CURRENT_DATE,
  p_ip         text    DEFAULT NULL,
  p_user_agent text    DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id  uuid;
  v_negocio_nom text;
  v_ip_clean    text;
  v_ua_clean    text;
BEGIN
  v_ip_clean := nullif(trim(coalesce(p_ip, '')), '');
  v_ua_clean := nullif(trim(coalesce(p_user_agent, '')), '');

  -- Negocio del usuario: dueño primero, si no cualquier membresía (empleado/admin)
  SELECT un.negocio_id, n.nombre
  INTO v_negocio_id, v_negocio_nom
  FROM usuarios_negocio un
  JOIN negocios n ON n.id = un.negocio_id
  WHERE un.user_id = p_user_id
  ORDER BY (un.rol = 'dueno') DESC, un.created_at
  LIMIT 1;

  INSERT INTO bitacora_accesos (
    user_id, email_usuario, fecha,
    negocio_id, negocio_nombre,
    ip_addresses, user_agents
  )
  VALUES (
    p_user_id, p_email, p_fecha,
    v_negocio_id, v_negocio_nom,
    CASE WHEN v_ip_clean IS NOT NULL THEN ARRAY[v_ip_clean] ELSE '{}'::text[] END,
    CASE WHEN v_ua_clean IS NOT NULL THEN ARRAY[v_ua_clean] ELSE '{}'::text[] END
  )
  ON CONFLICT (user_id, fecha) DO UPDATE SET
    ultima_vista   = now(),
    num_vistas     = bitacora_accesos.num_vistas + 1,
    negocio_id     = COALESCE(bitacora_accesos.negocio_id,    v_negocio_id),
    negocio_nombre = COALESCE(bitacora_accesos.negocio_nombre, v_negocio_nom),
    ip_addresses   = CASE
      WHEN v_ip_clean IS NULL                               THEN bitacora_accesos.ip_addresses
      WHEN v_ip_clean = ANY(bitacora_accesos.ip_addresses) THEN bitacora_accesos.ip_addresses
      ELSE bitacora_accesos.ip_addresses || v_ip_clean
    END,
    user_agents    = CASE
      WHEN v_ua_clean IS NULL                               THEN bitacora_accesos.user_agents
      WHEN v_ua_clean = ANY(bitacora_accesos.user_agents)  THEN bitacora_accesos.user_agents
      WHEN array_length(bitacora_accesos.user_agents, 1) >= 10 THEN bitacora_accesos.user_agents
      ELSE bitacora_accesos.user_agents || v_ua_clean
    END;
END;
$$;

-- Backfill: filas sin negocio cuyos usuarios sí tienen membresía
UPDATE bitacora_accesos b
SET negocio_id     = m.negocio_id,
    negocio_nombre = m.nombre
FROM (
  SELECT DISTINCT ON (un.user_id) un.user_id, un.negocio_id, n.nombre
  FROM usuarios_negocio un
  JOIN negocios n ON n.id = un.negocio_id
  ORDER BY un.user_id, (un.rol = 'dueno') DESC, un.created_at
) m
WHERE b.user_id = m.user_id AND b.negocio_id IS NULL;

-- ─── 4. sa_actividad_dia ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sa_actividad_dia()
RETURNS TABLE(
  user_id        uuid,
  email_usuario  text,
  rol            text,
  negocio_id     uuid,
  negocio_nombre text,
  negocio_lat    double precision,
  negocio_lon    double precision,
  primera_vista  timestamptz,
  ultima_vista   timestamptz,
  num_vistas     integer,
  ip_addresses   text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  RETURN QUERY
  SELECT
    b.user_id,
    b.email_usuario,
    un.rol::text,
    b.negocio_id,
    b.negocio_nombre,
    n.lat,
    n.lon,
    b.primera_vista,
    b.ultima_vista,
    b.num_vistas,
    b.ip_addresses
  FROM bitacora_accesos b
  LEFT JOIN LATERAL (
    SELECT u.rol FROM usuarios_negocio u
    WHERE u.user_id = b.user_id
    ORDER BY (u.rol = 'dueno') DESC, u.created_at
    LIMIT 1
  ) un ON true
  LEFT JOIN negocios n ON n.id = b.negocio_id
  WHERE b.fecha = (now() AT TIME ZONE 'America/Mexico_City')::date
  ORDER BY b.ultima_vista DESC;
END;
$$;

COMMENT ON FUNCTION sa_actividad_dia IS
  'Actividad de hoy por usuario para /superadmin/accesos: rol, negocio (con coords), '
  'primera/última vista, visitas e IPs del día.';

-- ─── 5. sa_negocios_mapa ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sa_negocios_mapa()
RETURNS TABLE(
  id         uuid,
  nombre     text,
  ubicacion  text,
  lat        double precision,
  lon        double precision,
  es_demo    boolean,
  suspendido boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  RETURN QUERY
  SELECT n.id, n.nombre, n.ubicacion, n.lat, n.lon, n.es_demo, n.suspendido
  FROM negocios n
  WHERE n.lat IS NOT NULL AND n.lon IS NOT NULL
  ORDER BY n.nombre;
END;
$$;

COMMENT ON FUNCTION sa_negocios_mapa IS
  'Locales con coordenadas para el mapa del superadmin.';
