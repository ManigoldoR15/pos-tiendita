-- ── 1. Columna max_cajas (default 1 = comportamiento actual sin romper nada) ──
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS max_cajas integer NOT NULL DEFAULT 1;

-- ── 2. Eliminar índice único por negocio (solo 1 abierto en total) ────────────
DROP INDEX IF EXISTS idx_cortes_un_abierto;

-- ── 3. Nuevo índice único: evita 2 cajas abiertas en el MISMO local ───────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_cortes_un_abierto_local
  ON cortes_caja (negocio_id, local_id)
  WHERE (estado = 'abierto' AND local_id IS NOT NULL);

-- ── 4. Trigger que limita el total de cajas abiertas según max_cajas ──────────
CREATE OR REPLACE FUNCTION check_max_cajas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_cur integer;
BEGIN
  IF NEW.estado IS DISTINCT FROM 'abierto' THEN RETURN NEW; END IF;

  SELECT max_cajas INTO v_max FROM negocios WHERE id = NEW.negocio_id;
  SELECT COUNT(*) INTO v_cur
    FROM cortes_caja
    WHERE negocio_id = NEW.negocio_id AND estado = 'abierto';

  IF v_cur >= v_max THEN
    RAISE EXCEPTION
      'LIMITE_CAJAS:Límite de cajas alcanzado: el plan permite hasta % caja(s) abiertas simultáneamente (ya tiene %).',
      v_max, v_cur;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_max_cajas ON cortes_caja;
CREATE TRIGGER trg_check_max_cajas
  BEFORE INSERT ON cortes_caja
  FOR EACH ROW EXECUTE FUNCTION check_max_cajas();

-- ── 5. Función superadmin para actualizar límite de cajas ─────────────────────
CREATE OR REPLACE FUNCTION actualizar_licencia_cajas(
  p_negocio_id uuid,
  p_max_cajas  integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur integer;
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'No autorizado.'; END IF;
  IF p_max_cajas < 1 THEN RAISE EXCEPTION 'El mínimo permitido es 1 caja.'; END IF;

  SELECT COUNT(*) INTO v_cur
    FROM cortes_caja
    WHERE negocio_id = p_negocio_id AND estado = 'abierto';

  IF v_cur > p_max_cajas THEN
    RAISE EXCEPTION
      'No se puede reducir a % caja(s): el negocio tiene % abiertas. Ciérralas primero.',
      p_max_cajas, v_cur;
  END IF;

  UPDATE negocios
    SET max_cajas = p_max_cajas, updated_at = now()
    WHERE id = p_negocio_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id; END IF;
END;
$$;

-- ── 6. Actualizar sa_negocio_detalle: agrega num_cajas ────────────────────────
CREATE OR REPLACE FUNCTION public.sa_negocio_detalle(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;
  RETURN jsonb_build_object(
    'negocio',       (SELECT row_to_json(n) FROM negocios n WHERE n.id = p_id),
    'num_plazas',    (SELECT COUNT(*)::int FROM locales WHERE negocio_id = p_id AND activo = true),
    'num_empleados', (SELECT COUNT(*)::int FROM usuarios_negocio WHERE negocio_id = p_id AND rol != 'dueno'),
    'num_cajas',     (SELECT COUNT(*)::int FROM cortes_caja WHERE negocio_id = p_id AND estado = 'abierto'),
    'plazas', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', l.id, 'nombre', l.nombre, 'direccion', l.direccion, 'color', l.color, 'activo', l.activo)
        ORDER BY l.created_at
      ), '[]'::jsonb)
      FROM locales l WHERE l.negocio_id = p_id
    ),
    'usuarios', (
      SELECT jsonb_agg(jsonb_build_object('email', u.email, 'rol', un.rol, 'creado_en', un.created_at))
      FROM usuarios_negocio un
      JOIN auth.users u ON u.id = un.user_id
      WHERE un.negocio_id = p_id
    ),
    'ventas_30d',     (SELECT COALESCE(sum(total),0) FROM ventas WHERE negocio_id=p_id AND estado='completada' AND created_at >= now()-interval '30 days'),
    'num_ventas_30d', (SELECT count(*) FROM ventas WHERE negocio_id=p_id AND estado='completada' AND created_at >= now()-interval '30 days'),
    'ticket_promedio',(SELECT ROUND(AVG(total)) FROM ventas WHERE negocio_id=p_id AND estado='completada'),
    'num_productos',  (SELECT count(*) FROM productos WHERE negocio_id=p_id AND activo=true),
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
        SELECT jsonb_build_object(
          'fecha', (created_at AT TIME ZONE 'America/Mexico_City')::date,
          'total', SUM(total)::bigint
        ) AS r,
        (created_at AT TIME ZONE 'America/Mexico_City')::date AS fecha
        FROM ventas WHERE negocio_id=p_id AND estado='completada' AND created_at >= now()-interval '7 days'
        GROUP BY fecha
      ) sub
    ),
    'gastos_30d', (SELECT COALESCE(sum(monto),0) FROM gastos WHERE negocio_id=p_id AND es_personal=false AND created_at >= now()-interval '30 days')
  );
END;
$$;
