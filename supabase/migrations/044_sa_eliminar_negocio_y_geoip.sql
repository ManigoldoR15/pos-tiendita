-- =============================================================================
-- 044_sa_eliminar_negocio_y_geoip.sql
--
-- Cambios:
--   1. sa_eliminar_negocio(): eliminación definitiva de un negocio y todos sus
--      datos (solo superadmin). Devuelve los user_ids que quedaron huérfanos
--      (sin negocio y sin ser superadmins) para borrarlos de auth.users desde
--      el server action con el service client.
--   2. ip_geo: caché de geolocalización por IP para la bitácora de accesos.
--      Sin políticas RLS → solo accesible con service_role.
-- =============================================================================

-- ─── 1. sa_eliminar_negocio ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sa_eliminar_negocio(p_negocio_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids  uuid[];
  v_huerfanos uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM negocios WHERE id = p_negocio_id) THEN
    RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT un.user_id), '{}')
  INTO v_user_ids
  FROM usuarios_negocio un
  WHERE un.negocio_id = p_negocio_id;

  -- Tablas con FK NO ACTION hacia negocios: limpiar manualmente antes
  DELETE FROM ajustes_inventario  WHERE negocio_id = p_negocio_id;
  DELETE FROM compras_items       WHERE negocio_id = p_negocio_id;
  DELETE FROM lista_precio_items  WHERE negocio_id = p_negocio_id;
  DELETE FROM merma_referencia    WHERE negocio_id = p_negocio_id;

  -- El resto de tablas cascadean (bitacora_accesos hace SET NULL y conserva historial)
  DELETE FROM negocios WHERE id = p_negocio_id;

  -- Usuarios que ya no pertenecen a ningún negocio y no son superadmins
  SELECT COALESCE(array_agg(u), '{}')
  INTO v_huerfanos
  FROM unnest(v_user_ids) AS u
  WHERE NOT EXISTS (SELECT 1 FROM usuarios_negocio un2 WHERE un2.user_id = u)
    AND NOT EXISTS (SELECT 1 FROM superadmins s WHERE s.user_id = u);

  RETURN v_huerfanos;
END;
$$;

GRANT EXECUTE ON FUNCTION sa_eliminar_negocio TO authenticated;

COMMENT ON FUNCTION sa_eliminar_negocio IS
  'Elimina definitivamente un negocio y todos sus datos. Solo superadmin. '
  'Devuelve los user_ids huérfanos para borrarlos de auth.users vía admin API.';

-- ─── 2. ip_geo — caché de geolocalización por IP ─────────────────────────────

CREATE TABLE IF NOT EXISTS ip_geo (
  ip         text PRIMARY KEY,
  ciudad     text,
  region     text,
  pais       text,
  isp        text,
  ok         boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ip_geo ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ip_geo IS
  'Caché de geolocalización por IP (ip-api.com) para la bitácora del superadmin. '
  'Sin políticas RLS: solo el service_role la lee/escribe.';
