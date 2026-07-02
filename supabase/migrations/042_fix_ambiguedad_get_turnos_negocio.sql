-- =============================================================================
-- MIGRACIÓN 042: Fix bug preexistente en get_turnos_negocio (misma causa que 041)
--
-- Mismo patrón de ambigüedad: "SELECT id FROM metodos_pago WHERE negocio_id
-- = cc.negocio_id ..." es ambiguo porque id/negocio_id son a la vez columnas
-- de metodos_pago y columnas de salida de la función (RETURNS TABLE(id uuid,
-- negocio_id uuid, ...)). Rompía la función en TODA llamada — es la razón
-- por la que el listado de "cortes de caja cerrados" fue removido de
-- /turnos/page.tsx en el WIP de módulos, dejando /turnos/[id] sin ningún
-- link que lleve ahí.
--
-- Fix: alias mp en las subconsultas de metodos_pago, igual que en 041.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_turnos_negocio(
  p_negocio_id uuid,
  p_cajero_id  uuid DEFAULT NULL::uuid,
  p_desde      date DEFAULT NULL::date,
  p_hasta      date DEFAULT NULL::date
)
 RETURNS TABLE(id uuid, negocio_id uuid, monto_inicial integer, fecha_apertura timestamp with time zone, fecha_cierre timestamp with time zone, monto_esperado integer, monto_contado integer, diferencia integer, notas text, abierto_por uuid, apertura_email text, apertura_rol text, cerrado_por uuid, cierre_email text, cierre_rol text, duracion_min numeric, total_ventas bigint, num_ventas bigint, ventas_efectivo bigint, ventas_otros bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RETURN;  -- sin filas, igual que RLS
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
    ua.email::text                                           AS apertura_email,
    COALESCE(un_a.rol::text, 'desconocido')                 AS apertura_rol,
    cc.cerrado_por,
    uc.email::text                                           AS cierre_email,
    COALESCE(un_c.rol::text, 'desconocido')                 AS cierre_rol,
    ROUND(
      EXTRACT(EPOCH FROM (cc.fecha_cierre - cc.fecha_apertura)) / 60.0
    , 1)                                                     AS duracion_min,
    COALESCE(SUM(v.total), 0)                               AS total_ventas,
    COUNT(v.id)                                              AS num_ventas,
    COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago_id IN (
      SELECT mp.id FROM metodos_pago mp
      WHERE mp.negocio_id = cc.negocio_id AND lower(mp.nombre) = 'efectivo' AND mp.activo
    )), 0)                                                   AS ventas_efectivo,
    COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago_id NOT IN (
      SELECT mp.id FROM metodos_pago mp
      WHERE mp.negocio_id = cc.negocio_id AND lower(mp.nombre) = 'efectivo' AND mp.activo
    ) AND v.metodo_pago_id IS NOT NULL), 0)                 AS ventas_otros
  FROM cortes_caja cc
  LEFT JOIN auth.users ua   ON ua.id = cc.abierto_por
  LEFT JOIN usuarios_negocio un_a
    ON un_a.user_id = cc.abierto_por AND un_a.negocio_id = cc.negocio_id
  LEFT JOIN auth.users uc   ON uc.id = cc.cerrado_por
  LEFT JOIN usuarios_negocio un_c
    ON un_c.user_id = cc.cerrado_por AND un_c.negocio_id = cc.negocio_id
  LEFT JOIN ventas v
    ON v.corte_id = cc.id AND v.estado = 'completada'
  WHERE cc.negocio_id = p_negocio_id
    AND cc.estado     = 'cerrado'
    AND (p_cajero_id IS NULL OR cc.abierto_por = p_cajero_id)
    AND (p_desde IS NULL
         OR cc.fecha_apertura >= p_desde::timestamptz)
    AND (p_hasta IS NULL
         OR cc.fecha_apertura < (p_hasta + INTERVAL '1 day')::timestamptz)
  GROUP BY
    cc.id, cc.negocio_id, cc.monto_inicial, cc.fecha_apertura, cc.fecha_cierre,
    cc.monto_esperado, cc.monto_contado, cc.diferencia, cc.notas,
    cc.abierto_por, ua.email, un_a.rol,
    cc.cerrado_por, uc.email, un_c.rol
  ORDER BY cc.fecha_cierre DESC;
END;
$function$;

COMMENT ON FUNCTION get_turnos_negocio(uuid, uuid, date, date) IS
  'Historial de cortes de caja cerrados para dueño. Fix migración 042: '
  'columnas de metodos_pago calificadas con alias mp para evitar '
  'ambigüedad con las columnas de salida del mismo nombre.';
