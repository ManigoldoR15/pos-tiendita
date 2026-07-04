-- =============================================================================
-- 054_rastro_gps_flotilla.sql — Módulo Reparto/Flotilla: rastro GPS del día
--
-- A diferencia de bitacora_accesos.gps_* (un punto por usuario/día, se
-- sobreescribe), rastro_gps acumula puntos para trazar la ruta recorrida.
--
--   - log_rastro(): el usuario reporta SU posición (auth.uid()); solo si el
--     negocio tiene el módulo 'repartidores' activo. Throttle de 60 s por
--     usuario y limpieza de puntos > 30 días. También refresca la bitácora.
--   - RLS: el dueño/admin ve el rastro de su negocio.
-- =============================================================================

CREATE TABLE IF NOT EXISTS rastro_gps (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id  uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lon         double precision NOT NULL,
  precision_m real,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rastro_negocio_fecha ON rastro_gps (negocio_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_rastro_user_fecha    ON rastro_gps (user_id, creado_en DESC);

ALTER TABLE rastro_gps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rastro_ver" ON rastro_gps;
CREATE POLICY "rastro_ver" ON rastro_gps
  FOR SELECT USING (es_admin_o_dueno_del_negocio(negocio_id));
-- INSERT solo vía log_rastro (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION log_rastro(
  p_lat       double precision,
  p_lon       double precision,
  p_precision real DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_negocio_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'access_denied';
  END IF;
  IF p_lat IS NULL OR p_lon IS NULL
     OR p_lat < -90 OR p_lat > 90 OR p_lon < -180 OR p_lon > 180 THEN
    RAISE EXCEPTION 'coordenadas_invalidas';
  END IF;

  -- Negocio del usuario con el módulo repartidores activo
  SELECT un.negocio_id INTO v_negocio_id
  FROM usuarios_negocio un
  JOIN negocios n ON n.id = un.negocio_id
  WHERE un.user_id = v_uid
    AND COALESCE(n.modulos_habilitados->>'repartidores', 'false') = 'true'
  ORDER BY (un.rol = 'dueno') DESC, un.created_at
  LIMIT 1;

  IF v_negocio_id IS NULL THEN
    RETURN; -- módulo apagado: no acumular nada
  END IF;

  -- Throttle: máximo un punto por minuto por usuario
  IF EXISTS (
    SELECT 1 FROM rastro_gps
    WHERE user_id = v_uid AND creado_en > now() - interval '60 seconds'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO rastro_gps (negocio_id, user_id, lat, lon, precision_m)
  VALUES (v_negocio_id, v_uid, p_lat, p_lon, LEAST(COALESCE(p_precision, 0), 99999));

  -- Limpieza: el rastro solo se conserva 30 días
  DELETE FROM rastro_gps
  WHERE user_id = v_uid AND creado_en < now() - interval '30 days';

  -- Mantener también la última posición del día (bitácora / mapa superadmin)
  PERFORM log_gps(p_lat, p_lon, p_precision);
END;
$$;

REVOKE EXECUTE ON FUNCTION log_rastro(double precision, double precision, real) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION log_rastro(double precision, double precision, real) TO authenticated, service_role;

COMMENT ON FUNCTION log_rastro IS
  'Punto de rastro GPS del usuario autenticado (módulo repartidores). '
  'Throttle 60 s, retención 30 días, refresca también la bitácora del día.';
