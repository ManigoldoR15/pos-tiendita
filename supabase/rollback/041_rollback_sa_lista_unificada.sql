-- ROLLBACK 041: restaura sa_lista_negocios a su versión de la migración 030
-- (sin campos de suscripción/contacto).

DROP FUNCTION IF EXISTS sa_lista_negocios();

CREATE FUNCTION sa_lista_negocios()
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

