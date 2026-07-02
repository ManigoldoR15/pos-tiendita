-- =============================================================================
-- MIGRACIÓN 041: Fix bug preexistente en get_turno_detalle
--
-- Bug (independiente de la migración 040): "SELECT negocio_id INTO
-- v_negocio_id FROM cortes_caja ..." es ambiguo porque negocio_id es a la
-- vez columna de cortes_caja y columna de salida de la función (RETURNS
-- TABLE(..., negocio_id uuid, ...)). Postgres no puede resolverlo y la
-- función truena con error 42702 en TODA llamada — /turnos/[id] devuelve
-- 404 para cualquier turno cerrado, para cualquier usuario.
--
-- Fix: calificar con el alias de tabla (cc.negocio_id). Sin cambios de
-- lógica ni de firma — misma función, un solo identificador calificado.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_turno_detalle(p_corte_id uuid)
 RETURNS TABLE(id uuid, negocio_id uuid, monto_inicial integer, fecha_apertura timestamp with time zone, fecha_cierre timestamp with time zone, monto_esperado integer, monto_contado integer, diferencia integer, notas text, abierto_por uuid, apertura_email text, apertura_rol text, cerrado_por uuid, cierre_email text, cierre_rol text, duracion_min numeric, total_ventas bigint, num_ventas bigint, ventas_efectivo bigint, ventas_otros bigint, total_fiado bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio_id uuid;
BEGIN
  SELECT cc.negocio_id INTO v_negocio_id
  FROM cortes_caja cc WHERE cc.id = p_corte_id AND cc.estado = 'cerrado';

  IF NOT FOUND OR NOT es_dueno_del_negocio(v_negocio_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cc.id,
    cc.negocio_id,
    cc.monto_inicial,
    cc.fecha_apertura,
    cc.fecha_cierre,
    cc.monto_esperado,
    cc.monto_contado,
    cc.diferencia,
    cc.notas,
    cc.abierto_por,
    ua.email::text,
    COALESCE(un_a.rol::text, 'desconocido'),
    cc.cerrado_por,
    uc.email::text,
    COALESCE(un_c.rol::text, 'desconocido'),
    ROUND(
      EXTRACT(EPOCH FROM (cc.fecha_cierre - cc.fecha_apertura)) / 60.0
    , 1),
    COALESCE(SUM(v.total), 0),
    COUNT(v.id),
    COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago_id IN (
      SELECT mp.id FROM metodos_pago mp
      WHERE mp.negocio_id = cc.negocio_id AND lower(mp.nombre) = 'efectivo' AND mp.activo
    )), 0),
    COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago_id NOT IN (
      SELECT mp.id FROM metodos_pago mp
      WHERE mp.negocio_id = cc.negocio_id AND lower(mp.nombre) = 'efectivo' AND mp.activo
    ) AND v.metodo_pago_id IS NOT NULL), 0),
    COALESCE(SUM(v.total) FILTER (WHERE v.es_fiado = true), 0)
  FROM cortes_caja cc
  LEFT JOIN auth.users ua   ON ua.id = cc.abierto_por
  LEFT JOIN usuarios_negocio un_a
    ON un_a.user_id = cc.abierto_por AND un_a.negocio_id = cc.negocio_id
  LEFT JOIN auth.users uc   ON uc.id = cc.cerrado_por
  LEFT JOIN usuarios_negocio un_c
    ON un_c.user_id = cc.cerrado_por AND un_c.negocio_id = cc.negocio_id
  LEFT JOIN ventas v
    ON v.corte_id = cc.id AND v.estado = 'completada'
  WHERE cc.id = p_corte_id
  GROUP BY
    cc.id, cc.negocio_id, cc.monto_inicial, cc.fecha_apertura, cc.fecha_cierre,
    cc.monto_esperado, cc.monto_contado, cc.diferencia, cc.notas,
    cc.abierto_por, ua.email, un_a.rol,
    cc.cerrado_por, uc.email, un_c.rol;
END;
$function$;

COMMENT ON FUNCTION get_turno_detalle(uuid) IS
  'Detalle de un corte cerrado para dueño. Fix migración 041: negocio_id '
  'calificado (cc.negocio_id) para evitar ambigüedad con la columna de '
  'salida del mismo nombre.';
