-- =============================================================================
-- 032_dashboard_plazas.sql — Dashboard comparativo de plazas (Fase D)
--
-- RPC: get_ventas_por_plaza(negocio_id, desde, hasta)
--   → por plaza activa: total_ventas, num_ventas, total_gastos, num_cortes
-- =============================================================================

CREATE OR REPLACE FUNCTION get_ventas_por_plaza(
  p_negocio_id uuid,
  p_desde      timestamptz,
  p_hasta      timestamptz
)
RETURNS TABLE(
  local_id      uuid,
  local_nombre  text,
  local_color   text,
  total_ventas  bigint,
  num_ventas    bigint,
  total_gastos  bigint,
  num_cortes    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede ver el comparativo de plazas.';
  END IF;

  RETURN QUERY
    SELECT
      l.id                                                                        AS local_id,
      l.nombre                                                                    AS local_nombre,
      l.color                                                                     AS local_color,
      COALESCE(SUM(v.total)  FILTER (WHERE v.estado = 'completada'), 0)::bigint  AS total_ventas,
      COUNT(v.id)            FILTER (WHERE v.estado = 'completada')               AS num_ventas,
      COALESCE(SUM(g.monto),  0)::bigint                                          AS total_gastos,
      COUNT(DISTINCT cc.id)  FILTER (WHERE cc.estado = 'cerrado')                 AS num_cortes
    FROM locales l
    LEFT JOIN ventas v
           ON v.local_id = l.id
          AND v.negocio_id = p_negocio_id
          AND v.created_at >= p_desde
          AND v.created_at  < p_hasta
    LEFT JOIN gastos g
           ON g.local_id = l.id
          AND g.negocio_id = p_negocio_id
          AND g.created_at >= p_desde
          AND g.created_at  < p_hasta
    LEFT JOIN cortes_caja cc
           ON cc.local_id = l.id
          AND cc.negocio_id = p_negocio_id
          AND cc.fecha_apertura >= p_desde
          AND cc.fecha_apertura  < p_hasta
    WHERE l.negocio_id = p_negocio_id
      AND l.activo     = true
    GROUP BY l.id, l.nombre, l.color
    ORDER BY total_ventas DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ventas_por_plaza TO authenticated;
