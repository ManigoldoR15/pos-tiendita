-- =============================================================================
-- 048_gps_ubicacion.sql — Ubicación GPS real (permiso del navegador)
--
-- Cambios:
--   1. bitacora_accesos: +gps_lat/gps_lon/gps_precision/gps_at — última
--      posición GPS reportada por el dispositivo del usuario en el día.
--   2. log_gps(): RPC para usuarios autenticados; usa auth.uid() (nadie puede
--      reportar GPS por otro). Valida rangos.
--   3. negocios.geo_fuente: nuevo valor 'auto_gps' (ancla por GPS del dueño;
--      gana a 'auto_ip', pierde contra 'direccion').
--   4. sa_actividad_dia(): devuelve también los campos GPS.
-- =============================================================================

-- ─── 1. Columnas GPS en bitácora ─────────────────────────────────────────────

ALTER TABLE bitacora_accesos
  ADD COLUMN IF NOT EXISTS gps_lat       double precision,
  ADD COLUMN IF NOT EXISTS gps_lon       double precision,
  ADD COLUMN IF NOT EXISTS gps_precision real,
  ADD COLUMN IF NOT EXISTS gps_at        timestamptz;

COMMENT ON COLUMN bitacora_accesos.gps_precision IS 'Precisión reportada por el dispositivo, en metros.';

-- ─── 2. log_gps ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_gps(
  p_lat       double precision,
  p_lon       double precision,
  p_precision real DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_hoy   date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'access_denied';
  END IF;
  IF p_lat IS NULL OR p_lon IS NULL
     OR p_lat < -90 OR p_lat > 90 OR p_lon < -180 OR p_lon > 180 THEN
    RAISE EXCEPTION 'coordenadas_invalidas';
  END IF;

  UPDATE bitacora_accesos
  SET gps_lat       = p_lat,
      gps_lon       = p_lon,
      gps_precision = LEAST(COALESCE(p_precision, 0), 99999),
      gps_at        = now()
  WHERE user_id = v_uid AND fecha = v_hoy;

  -- Si aún no hay fila del día (GPS llegó antes que el proxy), crearla mínima
  IF NOT FOUND THEN
    INSERT INTO bitacora_accesos (user_id, fecha, gps_lat, gps_lon, gps_precision, gps_at)
    VALUES (v_uid, v_hoy, p_lat, p_lon, LEAST(COALESCE(p_precision, 0), 99999), now())
    ON CONFLICT (user_id, fecha) DO UPDATE SET
      gps_lat = EXCLUDED.gps_lat, gps_lon = EXCLUDED.gps_lon,
      gps_precision = EXCLUDED.gps_precision, gps_at = EXCLUDED.gps_at;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION log_gps TO authenticated;

COMMENT ON FUNCTION log_gps IS
  'Guarda la posición GPS del usuario autenticado en su fila de bitácora del día. '
  'Solo puede reportar su propia posición (auth.uid()).';

-- ─── 3. geo_fuente admite auto_gps ───────────────────────────────────────────

ALTER TABLE negocios DROP CONSTRAINT IF EXISTS negocios_geo_fuente_check;
ALTER TABLE negocios ADD CONSTRAINT negocios_geo_fuente_check
  CHECK (geo_fuente IN ('direccion', 'auto_ip', 'auto_gps'));

-- ─── 4. sa_actividad_dia con GPS ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS sa_actividad_dia();

CREATE FUNCTION sa_actividad_dia()
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
  ip_addresses   text[],
  gps_lat        double precision,
  gps_lon        double precision,
  gps_precision  real,
  gps_at         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins s WHERE s.user_id = auth.uid()) THEN
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
    b.ip_addresses,
    b.gps_lat,
    b.gps_lon,
    b.gps_precision,
    b.gps_at
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
