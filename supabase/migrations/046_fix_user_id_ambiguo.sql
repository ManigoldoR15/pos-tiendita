-- =============================================================================
-- 046_fix_user_id_ambiguo.sql
--
-- Bug: en funciones con RETURNS TABLE(user_id …), el check
--   `SELECT 1 FROM superadmins WHERE user_id = auth.uid()`
-- es ambiguo (¿columna o variable OUT?) y plpgsql lanza error 42702 en
-- runtime → las RPC devolvían error y el panel mostraba secciones vacías.
-- Afectadas: sa_ips_por_usuario (desde 034) y sa_actividad_dia (045).
-- Fix: calificar la columna (superadmins s / s.user_id).
-- =============================================================================

CREATE OR REPLACE FUNCTION sa_ips_por_usuario(p_dias integer DEFAULT 7)
RETURNS TABLE(
  user_id        uuid,
  email_usuario  text,
  negocio_nombre text,
  negocio_id     uuid,
  num_ips        bigint,
  ips            text[],
  sospecha       boolean
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
  WITH ip_data AS (
    SELECT
      b.user_id,
      b.email_usuario,
      ARRAY_AGG(DISTINCT ip_elem ORDER BY ip_elem) AS ips
    FROM bitacora_accesos b,
      LATERAL UNNEST(b.ip_addresses) AS ip_elem
    WHERE b.fecha >= CURRENT_DATE - p_dias
      AND ip_elem IS NOT NULL
      AND ip_elem <> ''
    GROUP BY b.user_id, b.email_usuario
  )
  SELECT
    d.user_id,
    d.email_usuario,
    COALESCE(n.nombre, '—')                       AS negocio_nombre,
    n.id                                           AS negocio_id,
    CARDINALITY(d.ips)::bigint                    AS num_ips,
    d.ips,
    COALESCE(n.sospecha_cuenta_compartida, false)  AS sospecha
  FROM ip_data d
  LEFT JOIN usuarios_negocio un
         ON un.user_id = d.user_id AND un.rol = 'dueno'
  LEFT JOIN negocios n ON n.id = un.negocio_id
  ORDER BY CARDINALITY(d.ips) DESC, d.email_usuario;
END;
$$;

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
