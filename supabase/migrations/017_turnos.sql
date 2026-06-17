-- ============================================================
-- 017_turnos.sql  —  Turnos de caja: cerrado_por + funciones
-- ============================================================

-- 1. Quién cerró el turno (puede diferir de quien lo abrió)
ALTER TABLE cortes_caja
  ADD COLUMN IF NOT EXISTS cerrado_por uuid REFERENCES auth.users(id);

-- 2. Actualizar cerrar_corte: registra cerrado_por = auth.uid()
CREATE OR REPLACE FUNCTION cerrar_corte(
  p_corte_id      uuid,
  p_monto_contado integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corte       record;
  v_efectivo_id uuid;
  v_ventas_ef   integer := 0;
  v_esperado    integer;
  v_diferencia  integer;
BEGIN
  IF p_monto_contado < 0 THEN
    RAISE EXCEPTION 'El monto contado no puede ser negativo.';
  END IF;

  SELECT * INTO v_corte
  FROM   cortes_caja
  WHERE  id = p_corte_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corte de caja no encontrado: %.', p_corte_id;
  END IF;

  IF NOT es_admin_o_dueno_del_negocio(v_corte.negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede cerrar el corte de caja.';
  END IF;

  IF v_corte.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El corte % ya está cerrado.', p_corte_id;
  END IF;

  SELECT id INTO v_efectivo_id
  FROM   metodos_pago
  WHERE  negocio_id    = v_corte.negocio_id
    AND  lower(nombre) = 'efectivo'
    AND  activo        = true
  LIMIT 1;

  IF v_efectivo_id IS NOT NULL THEN
    SELECT COALESCE(SUM(total), 0) INTO v_ventas_ef
    FROM   ventas
    WHERE  corte_id       = p_corte_id
      AND  metodo_pago_id = v_efectivo_id
      AND  estado         = 'completada';
  END IF;

  v_esperado   := v_corte.monto_inicial + v_ventas_ef;
  v_diferencia := p_monto_contado - v_esperado;

  UPDATE cortes_caja SET
    fecha_cierre   = now(),
    monto_esperado = v_esperado,
    monto_contado  = p_monto_contado,
    diferencia     = v_diferencia,
    estado         = 'cerrado',
    cerrado_por    = auth.uid()
  WHERE id = p_corte_id;

  RETURN jsonb_build_object(
    'corte_id',        p_corte_id,
    'monto_inicial',   v_corte.monto_inicial,
    'ventas_efectivo', v_ventas_ef,
    'monto_esperado',  v_esperado,
    'monto_contado',   p_monto_contado,
    'diferencia',      v_diferencia
  );
END;
$$;

-- 3. Función: lista de turnos (solo dueño al nivel DB)
CREATE OR REPLACE FUNCTION get_turnos_negocio(
  p_negocio_id uuid,
  p_cajero_id  uuid    DEFAULT NULL,
  p_desde      date    DEFAULT NULL,
  p_hasta      date    DEFAULT NULL
) RETURNS TABLE (
  id              uuid,
  negocio_id      uuid,
  monto_inicial   integer,
  fecha_apertura  timestamptz,
  fecha_cierre    timestamptz,
  monto_esperado  integer,
  monto_contado   integer,
  diferencia      integer,
  notas           text,
  abierto_por     uuid,
  apertura_email  text,
  apertura_rol    text,
  cerrado_por     uuid,
  cierre_email    text,
  cierre_rol      text,
  duracion_min    numeric,
  total_ventas    bigint,
  num_ventas      bigint,
  ventas_efectivo bigint,
  ventas_otros    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
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
    ROUND(EXTRACT(EPOCH FROM (cc.fecha_cierre - cc.fecha_apertura)) / 60.0, 1),
    COALESCE(SUM(v.total), 0),
    COUNT(v.id),
    COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago_id IN (
      SELECT id FROM metodos_pago
      WHERE negocio_id = cc.negocio_id AND lower(nombre) = 'efectivo' AND activo
    )), 0),
    COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago_id NOT IN (
      SELECT id FROM metodos_pago
      WHERE negocio_id = cc.negocio_id AND lower(nombre) = 'efectivo' AND activo
    ) AND v.metodo_pago_id IS NOT NULL), 0)
  FROM cortes_caja cc
  LEFT JOIN auth.users ua ON ua.id = cc.abierto_por
  LEFT JOIN usuarios_negocio un_a ON un_a.user_id = cc.abierto_por AND un_a.negocio_id = cc.negocio_id
  LEFT JOIN auth.users uc ON uc.id = cc.cerrado_por
  LEFT JOIN usuarios_negocio un_c ON un_c.user_id = cc.cerrado_por AND un_c.negocio_id = cc.negocio_id
  LEFT JOIN ventas v ON v.corte_id = cc.id AND v.estado = 'completada'
  WHERE cc.negocio_id = p_negocio_id
    AND cc.estado = 'cerrado'
    AND (p_cajero_id IS NULL OR cc.abierto_por = p_cajero_id)
    AND (p_desde IS NULL OR cc.fecha_apertura >= p_desde::timestamptz)
    AND (p_hasta IS NULL OR cc.fecha_apertura < (p_hasta + INTERVAL '1 day')::timestamptz)
  GROUP BY
    cc.id, cc.negocio_id, cc.monto_inicial, cc.fecha_apertura, cc.fecha_cierre,
    cc.monto_esperado, cc.monto_contado, cc.diferencia, cc.notas,
    cc.abierto_por, ua.email, un_a.rol,
    cc.cerrado_por, uc.email, un_c.rol
  ORDER BY cc.fecha_cierre DESC;
END;
$$;

-- 4. Función: detalle de un turno (solo dueño al nivel DB)
CREATE OR REPLACE FUNCTION get_turno_detalle(
  p_corte_id uuid
) RETURNS TABLE (
  id              uuid,
  negocio_id      uuid,
  monto_inicial   integer,
  fecha_apertura  timestamptz,
  fecha_cierre    timestamptz,
  monto_esperado  integer,
  monto_contado   integer,
  diferencia      integer,
  notas           text,
  abierto_por     uuid,
  apertura_email  text,
  apertura_rol    text,
  cerrado_por     uuid,
  cierre_email    text,
  cierre_rol      text,
  duracion_min    numeric,
  total_ventas    bigint,
  num_ventas      bigint,
  ventas_efectivo bigint,
  ventas_otros    bigint,
  total_fiado     bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id uuid;
BEGIN
  SELECT negocio_id INTO v_negocio_id
  FROM cortes_caja WHERE id = p_corte_id AND estado = 'cerrado';

  IF NOT FOUND OR NOT es_dueno_del_negocio(v_negocio_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cc.id, cc.negocio_id, cc.monto_inicial,
    cc.fecha_apertura, cc.fecha_cierre,
    cc.monto_esperado, cc.monto_contado, cc.diferencia, cc.notas,
    cc.abierto_por,
    ua.email::text,
    COALESCE(un_a.rol::text, 'desconocido'),
    cc.cerrado_por,
    uc.email::text,
    COALESCE(un_c.rol::text, 'desconocido'),
    ROUND(EXTRACT(EPOCH FROM (cc.fecha_cierre - cc.fecha_apertura)) / 60.0, 1),
    COALESCE(SUM(v.total), 0),
    COUNT(v.id),
    COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago_id IN (
      SELECT id FROM metodos_pago
      WHERE negocio_id = cc.negocio_id AND lower(nombre) = 'efectivo' AND activo
    )), 0),
    COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago_id NOT IN (
      SELECT id FROM metodos_pago
      WHERE negocio_id = cc.negocio_id AND lower(nombre) = 'efectivo' AND activo
    ) AND v.metodo_pago_id IS NOT NULL), 0),
    COALESCE(SUM(v.total) FILTER (WHERE v.es_fiado = true), 0)
  FROM cortes_caja cc
  LEFT JOIN auth.users ua ON ua.id = cc.abierto_por
  LEFT JOIN usuarios_negocio un_a ON un_a.user_id = cc.abierto_por AND un_a.negocio_id = cc.negocio_id
  LEFT JOIN auth.users uc ON uc.id = cc.cerrado_por
  LEFT JOIN usuarios_negocio un_c ON un_c.user_id = cc.cerrado_por AND un_c.negocio_id = cc.negocio_id
  LEFT JOIN ventas v ON v.corte_id = cc.id AND v.estado = 'completada'
  WHERE cc.id = p_corte_id
  GROUP BY
    cc.id, cc.negocio_id, cc.monto_inicial, cc.fecha_apertura, cc.fecha_cierre,
    cc.monto_esperado, cc.monto_contado, cc.diferencia, cc.notas,
    cc.abierto_por, ua.email, un_a.rol,
    cc.cerrado_por, uc.email, un_c.rol;
END;
$$;
