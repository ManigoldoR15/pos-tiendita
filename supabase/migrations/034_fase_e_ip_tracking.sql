-- =============================================================================
-- 034_fase_e_ip_tracking.sql — Fase E: Detección anti cuenta-compartida por IP
--
-- Cambios:
--   1. negocios: +sospecha_cuenta_compartida boolean
--   2. log_acceso(): nueva firma con p_ip + p_user_agent; acumula IPs únicas
--                    sin duplicar; puebla negocio_id/negocio_nombre
--   3. sa_ips_por_usuario(): IPs distintas por usuario en N días (superadmin)
--   4. sa_marcar_sospecha(): marcar/desmarcar sospecha por negocio (superadmin)
-- =============================================================================

-- ─── 1. Campo sospecha en negocios ───────────────────────────────────────────

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS sospecha_cuenta_compartida boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN negocios.sospecha_cuenta_compartida IS
  'Marcado manualmente por el superadmin cuando detecta posible cuenta compartida.';

-- ─── 2. log_acceso — drop old 3-arg signature, create new 5-arg version ──────
-- Los parámetros nuevos son DEFAULT NULL → backward-compatible con llamadas
-- que solo pasan (p_user_id, p_email, p_fecha).

DROP FUNCTION IF EXISTS log_acceso(uuid, text, date);

CREATE FUNCTION log_acceso(
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

  -- Buscar el negocio donde el usuario es dueño
  SELECT un.negocio_id, n.nombre
  INTO v_negocio_id, v_negocio_nom
  FROM usuarios_negocio un
  JOIN negocios n ON n.id = un.negocio_id
  WHERE un.user_id = p_user_id
    AND un.rol = 'dueno'
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
    -- Acumular IPs únicas: añadir solo si no está ya en el array
    ip_addresses   = CASE
      WHEN v_ip_clean IS NULL                               THEN bitacora_accesos.ip_addresses
      WHEN v_ip_clean = ANY(bitacora_accesos.ip_addresses) THEN bitacora_accesos.ip_addresses
      ELSE bitacora_accesos.ip_addresses || v_ip_clean
    END,
    -- Acumular user-agents únicos: cap a 10 para no inflar la fila
    user_agents    = CASE
      WHEN v_ua_clean IS NULL                               THEN bitacora_accesos.user_agents
      WHEN v_ua_clean = ANY(bitacora_accesos.user_agents)  THEN bitacora_accesos.user_agents
      WHEN array_length(bitacora_accesos.user_agents, 1) >= 10 THEN bitacora_accesos.user_agents
      ELSE bitacora_accesos.user_agents || v_ua_clean
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION log_acceso TO service_role;

COMMENT ON FUNCTION log_acceso IS
  'Registra o actualiza la bitácora de accesos del día. Fire-and-forget desde middleware. '
  'Acumula IPs y user-agents únicos en arrays. Backward-compatible: p_ip/p_user_agent opcionales.';

-- ─── 3. sa_ips_por_usuario ────────────────────────────────────────────────────

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
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
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

COMMENT ON FUNCTION sa_ips_por_usuario IS
  'Para el panel de superadmin: IPs distintas por usuario en los últimos N días. '
  'Cuenta ≥ 3 IPs distintas sugiere posible cuenta compartida.';

-- ─── 4. sa_marcar_sospecha ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sa_marcar_sospecha(
  p_negocio_id uuid,
  p_sospecha   boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  UPDATE negocios
  SET sospecha_cuenta_compartida = p_sospecha,
      updated_at = now()
  WHERE id = p_negocio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION sa_marcar_sospecha IS
  'Marca o desmarca un negocio como sospecha de cuenta compartida. Solo superadmin.';
