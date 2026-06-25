-- =============================================================================
-- 030_multi_plaza_foundation.sql — Cimientos multi-plaza
--
-- Cambios:
--   1. locales: +direccion, +lat, +lng, +color, +updated_at
--   2. negocios: +max_plazas (control de licencia — superadmin lo configura)
--   3. usuarios_negocio/ventas/gastos: +local_id nullable (sin ruptura)
--   4. bitacora_accesos: +ip_addresses, +user_agents (anti cuenta-compartida)
--   5. crear_local(): RPC con validación de límite de licencia
--   6. actualizar_licencia_plazas(): RPC solo-superadmin
--   7. sa_lista_negocios: +max_plazas, +num_plazas
--   8. sa_negocio_detalle: +num_plazas, +plazas[]
--
-- BACKWARD COMPAT: todos los nuevos campos son nullable o tienen DEFAULT.
-- Negocios existentes siguen funcionando idéntico (max_plazas=1, local_id=NULL).
-- =============================================================================

-- ─── 1. Extender locales ─────────────────────────────────────────────────────

ALTER TABLE locales
  ADD COLUMN IF NOT EXISTS direccion  text,
  ADD COLUMN IF NOT EXISTS lat        numeric(10,7),
  ADD COLUMN IF NOT EXISTS lng        numeric(10,7),
  ADD COLUMN IF NOT EXISTS color      text NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER trg_locales_updated_at
  BEFORE UPDATE ON locales
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- ─── 2. Control de licencia en negocios ──────────────────────────────────────

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS max_plazas integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN negocios.max_plazas IS
  'Número máximo de plazas (locales) activas permitidas por la licencia. '
  'Lo configura el superadmin. DEFAULT 1 = negocio de una sola plaza.';

-- ─── 3. local_id en tablas transaccionales ───────────────────────────────────
-- NULL = sin asignación de plaza (negocios de una plaza, comportamiento actual)

ALTER TABLE usuarios_negocio
  ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES locales(id) ON DELETE SET NULL;

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES locales(id) ON DELETE SET NULL;

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES locales(id) ON DELETE SET NULL;

-- Índices para filtros por plaza
CREATE INDEX IF NOT EXISTS idx_ventas_local       ON ventas(local_id)       WHERE local_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_local        ON gastos(local_id)       WHERE local_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_negocio_local ON usuarios_negocio(local_id) WHERE local_id IS NOT NULL;

-- ─── 4. IP tracking en bitácora ──────────────────────────────────────────────

ALTER TABLE bitacora_accesos
  ADD COLUMN IF NOT EXISTS ip_addresses text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS user_agents  text[] NOT NULL DEFAULT '{}';

-- ─── 5. crear_local — con validación de límite de licencia ───────────────────

CREATE OR REPLACE FUNCTION crear_local(
  p_negocio_id uuid,
  p_nombre     text,
  p_direccion  text    DEFAULT NULL,
  p_lat        numeric DEFAULT NULL,
  p_lng        numeric DEFAULT NULL,
  p_color      text    DEFAULT '#6366f1'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_cur integer;
  v_id  uuid;
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede crear plazas.';
  END IF;

  IF trim(coalesce(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'El nombre de la plaza no puede estar vacío.';
  END IF;

  SELECT max_plazas INTO v_max FROM negocios WHERE id = p_negocio_id;
  SELECT COUNT(*)   INTO v_cur FROM locales  WHERE negocio_id = p_negocio_id AND activo = true;

  IF v_cur >= v_max THEN
    RAISE EXCEPTION 'LIMITE_PLAZAS:Alcanzaste el límite de % plaza(s) en tu licencia. Contacta al soporte para ampliarla.', v_max;
  END IF;

  INSERT INTO locales (negocio_id, nombre, direccion, lat, lng, color)
  VALUES (
    p_negocio_id,
    trim(p_nombre),
    nullif(trim(coalesce(p_direccion, '')), ''),
    p_lat,
    p_lng,
    coalesce(nullif(trim(coalesce(p_color, '')), ''), '#6366f1')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_local TO authenticated;

COMMENT ON FUNCTION crear_local IS
  'Crea una nueva plaza para el negocio. Valida el límite de licencia (max_plazas). '
  'Solo el dueño puede crear plazas. Lanza LIMITE_PLAZAS si ya alcanzó el máximo.';

-- ─── 6. actualizar_licencia_plazas — solo superadmin ─────────────────────────

CREATE OR REPLACE FUNCTION actualizar_licencia_plazas(
  p_negocio_id uuid,
  p_max_plazas integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur integer;
BEGIN
  IF NOT es_superadmin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  IF p_max_plazas < 1 THEN
    RAISE EXCEPTION 'El mínimo permitido es 1 plaza.';
  END IF;

  SELECT COUNT(*) INTO v_cur
  FROM locales
  WHERE negocio_id = p_negocio_id AND activo = true;

  IF v_cur > p_max_plazas THEN
    RAISE EXCEPTION
      'No se puede reducir a % plaza(s): el negocio ya tiene % activas. Desactiva plazas primero.',
      p_max_plazas, v_cur;
  END IF;

  UPDATE negocios
  SET max_plazas = p_max_plazas, updated_at = now()
  WHERE id = p_negocio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION actualizar_licencia_plazas IS
  'Ajusta el número máximo de plazas habilitadas para un negocio. Solo superadmin.';

-- ─── 7. sa_lista_negocios: +max_plazas, +num_plazas ─────────────────────────

CREATE OR REPLACE FUNCTION sa_lista_negocios()
RETURNS TABLE(
  id                  uuid,
  nombre              text,
  email_dueno         text,
  nombre_dueno        text,
  plan                text,
  suspendido          boolean,
  notas_admin         text,
  negocio_created_at  timestamptz,
  ventas_mes          bigint,
  num_ventas_mes      bigint,
  ultima_venta        timestamptz,
  activo_hoy          boolean,
  num_usuarios        bigint,
  tipo_negocio        text,
  ciudad              text,
  estado_mx           text,
  inscrito_sat        boolean,
  num_productos       bigint,
  dias_sin_venta      integer,
  last_sign_in        timestamptz,
  max_plazas          integer,
  num_plazas          bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_superadmin() THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.nombre,
    n.email_dueno,
    n.nombre_dueno,
    n.plan,
    n.suspendido,
    n.notas_admin,
    n.created_at                                              AS negocio_created_at,
    COALESCE(SUM(v.total) FILTER (
      WHERE date_trunc('month', v.created_at AT TIME ZONE 'America/Mexico_City')
            = date_trunc('month', now() AT TIME ZONE 'America/Mexico_City')
        AND v.estado = 'completada'
    ), 0)::bigint                                             AS ventas_mes,
    COUNT(v.id) FILTER (
      WHERE date_trunc('month', v.created_at AT TIME ZONE 'America/Mexico_City')
            = date_trunc('month', now() AT TIME ZONE 'America/Mexico_City')
        AND v.estado = 'completada'
    )::bigint                                                 AS num_ventas_mes,
    MAX(v.created_at) FILTER (WHERE v.estado = 'completada') AS ultima_venta,
    EXISTS (
      SELECT 1 FROM ventas v2
      WHERE v2.negocio_id = n.id AND v2.estado = 'completada'
        AND v2.created_at >= (now() AT TIME ZONE 'America/Mexico_City')::date
                              AT TIME ZONE 'America/Mexico_City'
    )                                                         AS activo_hoy,
    (SELECT count(*)::bigint FROM usuarios_negocio un WHERE un.negocio_id = n.id) AS num_usuarios,
    n.tipo_negocio,
    n.ciudad,
    n.estado_mx,
    n.inscrito_sat,
    (SELECT count(*)::bigint FROM productos p WHERE p.negocio_id = n.id AND p.activo = true) AS num_productos,
    CASE
      WHEN MAX(v.created_at) FILTER (WHERE v.estado = 'completada') IS NULL THEN 9999
      ELSE EXTRACT(DAY FROM now() - MAX(v.created_at) FILTER (WHERE v.estado = 'completada'))::int
    END                                                       AS dias_sin_venta,
    (SELECT au.last_sign_in_at FROM auth.users au WHERE au.id = n.owner_id) AS last_sign_in,
    n.max_plazas,
    (SELECT count(*)::bigint FROM locales l WHERE l.negocio_id = n.id AND l.activo = true) AS num_plazas
  FROM negocios n
  LEFT JOIN ventas v ON v.negocio_id = n.id
  GROUP BY n.id
  ORDER BY n.created_at DESC;
END;
$$;

-- ─── 8. sa_negocio_detalle: +num_plazas, +plazas[] ──────────────────────────
-- row_to_json(n) ya incluye max_plazas automáticamente al estar en negocios

CREATE OR REPLACE FUNCTION sa_negocio_detalle(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  RETURN jsonb_build_object(
    'negocio', (SELECT row_to_json(n) FROM negocios n WHERE n.id = p_id),
    'num_plazas', (SELECT COUNT(*)::int FROM locales WHERE negocio_id = p_id AND activo = true),
    'plazas', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', l.id, 'nombre', l.nombre,
          'direccion', l.direccion, 'color', l.color, 'activo', l.activo
        ) ORDER BY l.created_at
      ), '[]'::jsonb)
      FROM locales l WHERE l.negocio_id = p_id
    ),
    'usuarios', (
      SELECT jsonb_agg(jsonb_build_object('email', u.email, 'rol', un.rol, 'creado_en', un.created_at))
      FROM usuarios_negocio un
      JOIN auth.users u ON u.id = un.user_id
      WHERE un.negocio_id = p_id
    ),
    'ventas_30d', (SELECT COALESCE(sum(total),0) FROM ventas WHERE negocio_id=p_id AND estado='completada' AND created_at >= now()-interval '30 days'),
    'num_ventas_30d', (SELECT count(*) FROM ventas WHERE negocio_id=p_id AND estado='completada' AND created_at >= now()-interval '30 days'),
    'ticket_promedio', (SELECT ROUND(AVG(total)) FROM ventas WHERE negocio_id=p_id AND estado='completada'),
    'num_productos', (SELECT count(*) FROM productos WHERE negocio_id=p_id AND activo=true),
    'top_productos', (
      SELECT jsonb_agg(r) FROM (
        SELECT jsonb_build_object('nombre', p.nombre, 'unidades', SUM(vi.cantidad)::bigint, 'monto', SUM(vi.subtotal)::bigint) AS r
        FROM venta_items vi
        JOIN productos p ON p.id = vi.producto_id
        JOIN ventas v ON v.id = vi.venta_id
        WHERE v.negocio_id=p_id AND v.estado='completada' AND v.created_at >= now()-interval '30 days'
        GROUP BY p.nombre ORDER BY SUM(vi.cantidad) DESC LIMIT 5
      ) sub
    ),
    'ventas_7d', (
      SELECT jsonb_agg(r ORDER BY fecha) FROM (
        SELECT jsonb_build_object('fecha', (created_at AT TIME ZONE 'America/Mexico_City')::date, 'total', SUM(total)::bigint) AS r,
               (created_at AT TIME ZONE 'America/Mexico_City')::date AS fecha
        FROM ventas WHERE negocio_id=p_id AND estado='completada' AND created_at >= now()-interval '7 days'
        GROUP BY fecha
      ) sub
    ),
    'gastos_30d', (SELECT COALESCE(sum(monto),0) FROM gastos WHERE negocio_id=p_id AND es_personal=false AND created_at >= now()-interval '30 days')
  );
END;
$$;
