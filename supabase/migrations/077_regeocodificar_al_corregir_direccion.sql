-- =============================================================================
-- 077_regeocodificar_al_corregir_direccion.sql
--
-- PROBLEMA: `geo_intentado_en` se sella en el PRIMER intento de geocodificar la
-- dirección, aunque el intento falle. Si el dueño escribió mal la dirección
-- ("Monclov" en vez de "Monclova, Coahuila"), Nominatim no la encuentra, el
-- negocio se queda con la coordenada estimada por IP (precisión de ciudad, y a
-- veces la ciudad equivocada) y NUNCA se vuelve a intentar aunque después
-- corrija la dirección. El mapa del superadmin lo muestra mal para siempre.
--
-- FIX: al cambiar `ubicacion`, se limpia `geo_intentado_en` para que la próxima
-- carga del panel vuelva a geocodificar con el texto nuevo.
-- =============================================================================

CREATE OR REPLACE FUNCTION reintentar_geocode_al_cambiar_direccion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ubicacion IS DISTINCT FROM OLD.ubicacion THEN
    NEW.geo_intentado_en := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION reintentar_geocode_al_cambiar_direccion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reintentar_geocode_al_cambiar_direccion ON negocios;
CREATE TRIGGER trg_reintentar_geocode_al_cambiar_direccion
  BEFORE UPDATE ON negocios
  FOR EACH ROW EXECUTE FUNCTION reintentar_geocode_al_cambiar_direccion();

COMMENT ON FUNCTION reintentar_geocode_al_cambiar_direccion IS
  'Al corregir la dirección de un negocio, borra geo_intentado_en para que se '
  'vuelva a geocodificar (la dirección escrita manda sobre la estimación por IP).';
