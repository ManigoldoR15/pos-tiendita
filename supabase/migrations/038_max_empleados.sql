-- ── 1. Columna max_empleados (default 50 → no corta negocios existentes) ───────
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS max_empleados integer NOT NULL DEFAULT 50;

-- ── 2. Trigger de enforcement en usuarios_negocio ────────────────────────────
CREATE OR REPLACE FUNCTION check_max_empleados()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_cur integer;
BEGIN
  -- El dueño nunca cuenta para el límite de empleados
  IF NEW.rol = 'dueno' THEN RETURN NEW; END IF;

  SELECT max_empleados INTO v_max FROM negocios WHERE id = NEW.negocio_id;
  SELECT COUNT(*) INTO v_cur
    FROM usuarios_negocio
    WHERE negocio_id = NEW.negocio_id AND rol != 'dueno';

  IF v_cur >= v_max THEN
    RAISE EXCEPTION
      'Límite de empleados alcanzado: el plan permite hasta % empleado(s) (ya tiene %).',
      v_max, v_cur;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_max_empleados ON usuarios_negocio;
CREATE TRIGGER trg_check_max_empleados
  BEFORE INSERT ON usuarios_negocio
  FOR EACH ROW EXECUTE FUNCTION check_max_empleados();

-- ── 3. Función superadmin para actualizar el límite ──────────────────────────
CREATE OR REPLACE FUNCTION actualizar_licencia_empleados(
  p_negocio_id    uuid,
  p_max_empleados integer
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
  IF p_max_empleados < 0 THEN RAISE EXCEPTION 'El mínimo permitido es 0.'; END IF;

  SELECT COUNT(*) INTO v_cur
    FROM usuarios_negocio
    WHERE negocio_id = p_negocio_id AND rol != 'dueno';

  IF v_cur > p_max_empleados THEN
    RAISE EXCEPTION
      'No se puede reducir a % empleado(s): el negocio ya tiene % activos. Elimina empleados primero.',
      p_max_empleados, v_cur;
  END IF;

  UPDATE negocios
    SET max_empleados = p_max_empleados, updated_at = now()
    WHERE id = p_negocio_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id; END IF;
END;
$$;

-- ── 4. Función superadmin para crear negocio en nombre de otro usuario ───────
CREATE OR REPLACE FUNCTION sa_crear_negocio(p_owner_id uuid, p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;
  IF p_nombre IS NULL OR trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre del negocio es obligatorio.';
  END IF;

  INSERT INTO negocios (nombre, owner_id)
    VALUES (trim(p_nombre), p_owner_id)
    RETURNING id INTO v_negocio_id;

  INSERT INTO usuarios_negocio (negocio_id, user_id, rol)
    VALUES (v_negocio_id, p_owner_id, 'dueno');

  INSERT INTO categorias_gasto (negocio_id, nombre, orden) VALUES
    (v_negocio_id, 'Luz',                 1),
    (v_negocio_id, 'Agua',                2),
    (v_negocio_id, 'Gas',                 3),
    (v_negocio_id, 'Renta',               4),
    (v_negocio_id, 'Gasolina',            5),
    (v_negocio_id, 'Sueldos',             6),
    (v_negocio_id, 'Mercancía',           7),
    (v_negocio_id, 'Internet y teléfono', 8),
    (v_negocio_id, 'Otro',                9);

  INSERT INTO metodos_pago (negocio_id, nombre) VALUES
    (v_negocio_id, 'Efectivo'),
    (v_negocio_id, 'Tarjeta débito'),
    (v_negocio_id, 'Tarjeta crédito'),
    (v_negocio_id, 'Transferencia (SPEI)');

  RETURN v_negocio_id;
END;
$$;

-- ── 5. Actualizar sa_negocio_detalle: agrega num_empleados ───────────────────
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
