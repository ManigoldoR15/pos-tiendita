-- =============================================================================
-- MIGRACIÓN 043: flag demo/prueba (Fase 5 — superadmin)
--
-- negocios.es_demo = true → el negocio sigue 100% funcional y visible en la
-- lista (con badge "Demo"), pero DEJA DE CONTAR en KPIs, estudios y cobranza.
-- Nada se borra; el toggle en la ficha permite corregir cualquier marcado.
--
-- Marcado inicial (criterio conservador, corregible con el toggle):
--   - nombre contiene "demo", "e2e" o "prueba" (tiendas de test/demostración)
--   - email del dueño en @demo.postiendita.mx (datos seed de demostración)
--
-- RPCs actualizados para excluir demos: sa_stats_globales, sa_estudios_*.
-- sa_lista_negocios ahora devuelve es_demo (los muestra, no los oculta).
-- No toca la app de los negocios.
--
-- Rollback: supabase/rollback/043_rollback_flag_demo.sql
-- =============================================================================

ALTER TABLE negocios ADD COLUMN IF NOT EXISTS es_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN negocios.es_demo IS
  'true = negocio de demostración/prueba: funcional pero excluido de KPIs, estudios y cobranza del superadmin.';

-- Marcado inicial
UPDATE negocios
SET es_demo = true
WHERE nombre ILIKE '%demo%'
   OR nombre ILIKE '%e2e%'
   OR nombre ILIKE '%prueba%'
   OR email_dueno LIKE '%@demo.postiendita.mx';

-- ─────────────────────────────────────────────────────────────────────────────
-- sa_lista_negocios: + es_demo (el tipo de retorno cambia → drop primero)
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS sa_lista_negocios();

CREATE FUNCTION sa_lista_negocios()
RETURNS TABLE(
  id                  uuid,
  nombre              text,
  email_dueno         text,
  nombre_dueno        text,
  telefono_dueno      text,
  ubicacion           text,
  plan                text,
  suscripcion_inicio  date,
  suscripcion_fin     date,
  estado_suscripcion  text,
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
  num_plazas          bigint,
  es_demo             boolean
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
    n.telefono_dueno,
    n.ubicacion,
    n.plan,
    n.suscripcion_inicio,
    n.suscripcion_fin,
    CASE
      WHEN n.suspendido THEN 'suspendido'
      WHEN n.plan = 'prueba' THEN 'prueba'
      WHEN n.suscripcion_fin IS NULL THEN 'activo'
      WHEN n.suscripcion_fin >= CURRENT_DATE THEN 'activo'
      ELSE 'vencido'
    END                                                       AS estado_suscripcion,
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
    (SELECT count(*)::bigint FROM locales l WHERE l.negocio_id = n.id AND l.activo = true) AS num_plazas,
    n.es_demo
  FROM negocios n
  LEFT JOIN ventas v ON v.negocio_id = n.id
  GROUP BY n.id
  ORDER BY n.created_at DESC;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- sa_stats_globales: excluir negocios demo de TODAS las métricas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sa_stats_globales()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;
  RETURN jsonb_build_object(
    'total_negocios', (SELECT count(*) FROM negocios WHERE NOT es_demo),
    'ventas_hoy', (SELECT COALESCE(sum(total),0) FROM ventas WHERE estado='completada' AND created_at >= (now() AT TIME ZONE 'America/Mexico_City')::date AT TIME ZONE 'America/Mexico_City' AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)),
    'ventas_mes', (SELECT COALESCE(sum(total),0) FROM ventas WHERE estado='completada' AND date_trunc('month', created_at AT TIME ZONE 'America/Mexico_City') = date_trunc('month', now() AT TIME ZONE 'America/Mexico_City') AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)),
    'num_ventas_hoy', (SELECT count(*) FROM ventas WHERE estado='completada' AND created_at >= (now() AT TIME ZONE 'America/Mexico_City')::date AT TIME ZONE 'America/Mexico_City' AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)),
    'negocios_activos_hoy', (SELECT count(DISTINCT negocio_id) FROM ventas WHERE estado='completada' AND created_at >= (now() AT TIME ZONE 'America/Mexico_City')::date AT TIME ZONE 'America/Mexico_City' AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)),
    'total_registros_usuarios_negocio', (SELECT count(*) FROM usuarios_negocio WHERE negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)),
    'negocios_nuevos_mes', (SELECT count(*) FROM negocios WHERE NOT es_demo AND date_trunc('month', created_at) = date_trunc('month', now())),
    'negocios_suspendidos', (SELECT count(*) FROM negocios WHERE NOT es_demo AND suspendido = true),
    'monto_historico', (SELECT COALESCE(sum(total),0) FROM ventas WHERE estado='completada' AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)),
    'total_ventas_historico', (SELECT count(*) FROM ventas WHERE estado='completada' AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)),
    'top_productos_30d', (
      SELECT jsonb_agg(r) FROM (
        SELECT jsonb_build_object('nombre', p.nombre, 'unidades', SUM(vi.cantidad)::bigint, 'monto', SUM(vi.subtotal)::bigint) AS r
        FROM venta_items vi
        JOIN productos p ON p.id = vi.producto_id
        JOIN ventas v ON v.id = vi.venta_id
        WHERE v.estado='completada' AND v.created_at >= now() - interval '30 days'
          AND v.negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)
        GROUP BY p.nombre ORDER BY SUM(vi.cantidad) DESC LIMIT 10
      ) sub
    ),
    'metodos_pago_dist', (
      SELECT jsonb_agg(r) FROM (
        SELECT jsonb_build_object(
          'nombre', COALESCE(mp.nombre,'Otro'),
          'num', COUNT(v.id)::bigint,
          'pct', ROUND(100.0 * COUNT(v.id) / NULLIF((SELECT count(*) FROM ventas WHERE estado='completada' AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)),0), 1)
        ) AS r
        FROM ventas v
        LEFT JOIN metodos_pago mp ON mp.id = v.metodo_pago_id
        WHERE v.estado='completada'
          AND v.negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)
        GROUP BY mp.nombre ORDER BY COUNT(v.id) DESC LIMIT 6
      ) sub
    ),
    'ventas_por_hora', (
      SELECT jsonb_agg(r ORDER BY hora) FROM (
        SELECT jsonb_build_object('hora', h, 'num', COALESCE(cnt,0)::bigint) AS r, h AS hora
        FROM generate_series(0, 23) AS h
        LEFT JOIN (
          SELECT EXTRACT(hour FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS hr, count(*) AS cnt
          FROM ventas WHERE estado='completada' AND created_at >= now() - interval '30 days'
            AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)
          GROUP BY hr
        ) sub ON sub.hr = h
      ) sub2
    ),
    'ventas_por_dia', (
      SELECT jsonb_agg(r ORDER BY dia) FROM (
        SELECT jsonb_build_object('dia', EXTRACT(dow FROM created_at AT TIME ZONE 'America/Mexico_City')::int,
          'nombre', CASE EXTRACT(dow FROM created_at AT TIME ZONE 'America/Mexico_City')::int
            WHEN 0 THEN 'Dom' WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar'
            WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' ELSE 'Sáb' END,
          'num', count(*)::bigint) AS r,
          EXTRACT(dow FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS dia
        FROM ventas WHERE estado='completada' AND created_at >= now() - interval '90 days'
          AND negocio_id IN (SELECT id FROM negocios WHERE NOT es_demo)
        GROUP BY dia
      ) sub
    )
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- sa_estudios_*: excluir demos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sa_estudios_crecimiento()
RETURNS TABLE(mes text, nuevos bigint)
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
    to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM') AS mes,
    COUNT(*)::bigint AS nuevos
  FROM negocios
  WHERE created_at >= now() - INTERVAL '12 months'
    AND NOT es_demo
  GROUP BY 1
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION sa_estudios_retencion()
RETURNS TABLE(bucket text, cantidad bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;
  RETURN QUERY
  WITH ultima AS (
    SELECT
      n.id,
      MAX(v.created_at) FILTER (WHERE v.estado = 'completada') AS ultima_venta
    FROM negocios n
    LEFT JOIN ventas v ON v.negocio_id = n.id
    WHERE NOT n.es_demo
    GROUP BY n.id
  ),
  buckets AS (
    SELECT
      CASE
        WHEN ultima_venta >= now() - INTERVAL '7 days'  THEN 'activo_7d'
        WHEN ultima_venta >= now() - INTERVAL '30 days' THEN 'activo_30d'
        WHEN ultima_venta >= now() - INTERVAL '90 days' THEN 'inactivo_30_90d'
        ELSE 'inactivo_90d_mas'
      END AS bucket
    FROM ultima
  )
  SELECT b.bucket, COUNT(*)::bigint FROM buckets b GROUP BY b.bucket;
END;
$$;

CREATE OR REPLACE FUNCTION sa_estudios_segmentacion()
RETURNS TABLE(tipo text, cantidad bigint, ventas_mes bigint, pct_sat numeric)
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
    n.tipo_negocio AS tipo,
    COUNT(DISTINCT n.id)::bigint AS cantidad,
    COALESCE(SUM(v.total) FILTER (
      WHERE date_trunc('month', v.created_at AT TIME ZONE 'America/Mexico_City')
            = date_trunc('month', now() AT TIME ZONE 'America/Mexico_City')
        AND v.estado = 'completada'
    ), 0)::bigint AS ventas_mes,
    ROUND(AVG(CASE WHEN n.inscrito_sat THEN 100.0 ELSE 0.0 END), 1) AS pct_sat
  FROM negocios n
  LEFT JOIN ventas v ON v.negocio_id = n.id
  WHERE NOT n.es_demo
  GROUP BY n.tipo_negocio
  ORDER BY COUNT(DISTINCT n.id) DESC;
END;
$$;
