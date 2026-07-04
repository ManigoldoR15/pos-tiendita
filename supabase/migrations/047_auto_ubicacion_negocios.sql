-- =============================================================================
-- 047_auto_ubicacion_negocios.sql — Auto-ubicación de negocios por IP del dueño
--
-- Cambios:
--   1. negocios.geo_fuente: de dónde salieron lat/lon:
--        'direccion' → geocodificado de la dirección escrita (manda siempre)
--        'auto_ip'   → estimado por la IP del dueño al entrar (se va refrescando)
--   2. Backfill: coords existentes vienen de geocodificar `ubicacion`.
--   3. sa_negocios_mapa() devuelve geo_fuente para etiquetar el marcador.
-- =============================================================================

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS geo_fuente text
  CHECK (geo_fuente IN ('direccion', 'auto_ip'));

COMMENT ON COLUMN negocios.geo_fuente IS
  'Origen de lat/lon: direccion (geocodificada, manual) o auto_ip (estimada por IP del dueño).';

UPDATE negocios SET geo_fuente = 'direccion'
WHERE lat IS NOT NULL AND geo_fuente IS NULL;

DROP FUNCTION IF EXISTS sa_negocios_mapa();

CREATE FUNCTION sa_negocios_mapa()
RETURNS TABLE(
  id         uuid,
  nombre     text,
  ubicacion  text,
  lat        double precision,
  lon        double precision,
  es_demo    boolean,
  suspendido boolean,
  geo_fuente text
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
  SELECT n.id, n.nombre, n.ubicacion, n.lat, n.lon, n.es_demo, n.suspendido, n.geo_fuente
  FROM negocios n
  WHERE n.lat IS NOT NULL AND n.lon IS NOT NULL
  ORDER BY n.nombre;
END;
$$;

COMMENT ON FUNCTION sa_negocios_mapa IS
  'Locales con coordenadas para el mapa del superadmin, con el origen de la coordenada.';
