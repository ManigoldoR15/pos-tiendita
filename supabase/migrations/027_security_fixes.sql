-- =============================================================================
-- 027_security_fixes.sql — Hardening de seguridad post-auditoría
--
-- Cierra: M1 (ajustes inventario sin rol), M2 (lotes RLS cualquier miembro),
--         M4 (buscar_usuario_por_email enumerable), B1 (gastos leídos por
--         empleados), B4 (política temas_estacionales inerte).
--
-- IMPORTANTE: Las funciones SECURITY DEFINER (registrar_venta, registrar_compra,
-- etc.) BYPASEAN RLS, por lo que los cambios en lotes_producto NO afectan el
-- descuento de stock FEFO en ventas ni el registro de compras.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- M2: lotes_producto — INSERT y UPDATE solo dueño/admin
-- Las RPCs SECURITY DEFINER no necesitan estas políticas (las bypasean).
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "lotes_insertar"   ON lotes_producto;
DROP POLICY IF EXISTS "lotes_actualizar" ON lotes_producto;

CREATE POLICY "lotes_insertar" ON lotes_producto
  FOR INSERT WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "lotes_actualizar" ON lotes_producto
  FOR UPDATE USING (es_admin_o_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- B1: gastos — SELECT restringido a dueño/admin
-- Antes: es_miembro (empleados podían leer gastos y sueldos por API directa).
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "gastos_ver" ON gastos;

CREATE POLICY "gastos_ver" ON gastos
  FOR SELECT USING (es_admin_o_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- M1a: ajustes_inventario INSERT — solo dueño/admin
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "miembros insertan ajustes" ON ajustes_inventario;

CREATE POLICY "admins insertan ajustes" ON ajustes_inventario
  FOR INSERT WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- M1b: registrar_ajuste_inventario — es_miembro → es_admin_o_dueno
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_ajuste_inventario(
  p_negocio_id  uuid,
  p_producto_id uuid,
  p_lote_id     uuid,
  p_delta       numeric,
  p_motivo      text,
  p_notas       text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cantidad_antes   numeric(12,3);
  v_cantidad_despues numeric(12,3);
  v_ajuste_id        uuid;
BEGIN
  IF NOT es_admin_o_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede registrar ajustes de inventario.';
  END IF;

  IF p_delta = 0 THEN
    RAISE EXCEPTION 'El delta del ajuste no puede ser cero.';
  END IF;

  SELECT cantidad_actual
  INTO   v_cantidad_antes
  FROM   lotes_producto
  WHERE  id          = p_lote_id
    AND  negocio_id  = p_negocio_id
    AND  producto_id = p_producto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado o no pertenece a este producto/negocio.';
  END IF;

  v_cantidad_despues := v_cantidad_antes + p_delta;

  IF v_cantidad_despues < 0 THEN
    RAISE EXCEPTION
      'El ajuste dejaría el lote en cantidad negativa (antes: %, delta: %).',
      v_cantidad_antes, p_delta;
  END IF;

  UPDATE lotes_producto
  SET    cantidad_actual = v_cantidad_despues,
         updated_at      = now()
  WHERE  id = p_lote_id;

  INSERT INTO ajustes_inventario (
    negocio_id, producto_id, lote_id,
    delta, cantidad_antes, cantidad_despues,
    motivo, notas, registrado_por
  ) VALUES (
    p_negocio_id, p_producto_id, p_lote_id,
    p_delta, v_cantidad_antes, v_cantidad_despues,
    p_motivo, p_notas, auth.uid()
  )
  RETURNING id INTO v_ajuste_id;

  RETURN v_ajuste_id;
END;
$$;

COMMENT ON FUNCTION registrar_ajuste_inventario IS
  'Ajuste de inventario para productos granel (por lote). '
  'SEGURIDAD: requiere rol dueño o administrador.';

-- ─────────────────────────────────────────────────────────────────────────────
-- M1c: registrar_ajuste_pieza — es_miembro → es_admin_o_dueno
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_ajuste_pieza(
  p_negocio_id  uuid,
  p_producto_id uuid,
  p_delta       numeric,
  p_motivo      text,
  p_notas       text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existencias_antes   numeric(12,3);
  v_existencias_despues numeric(12,3);
  v_ajuste_id           uuid;
BEGIN
  IF NOT es_admin_o_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede registrar ajustes de inventario.';
  END IF;

  IF p_delta = 0 THEN
    RAISE EXCEPTION 'El delta del ajuste no puede ser cero.';
  END IF;

  SELECT existencias INTO v_existencias_antes
  FROM   productos
  WHERE  id = p_producto_id AND negocio_id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  v_existencias_despues := v_existencias_antes + p_delta;

  IF v_existencias_despues < 0 THEN
    RAISE EXCEPTION 'El ajuste dejaría el producto en cantidad negativa (antes: %, delta: %).',
      v_existencias_antes, p_delta;
  END IF;

  UPDATE productos
  SET    existencias = v_existencias_despues,
         updated_at  = now()
  WHERE  id = p_producto_id;

  INSERT INTO ajustes_inventario (
    negocio_id, producto_id, lote_id,
    delta, cantidad_antes, cantidad_despues,
    motivo, notas, registrado_por
  ) VALUES (
    p_negocio_id, p_producto_id, NULL,
    p_delta, v_existencias_antes, v_existencias_despues,
    p_motivo, p_notas, auth.uid()
  )
  RETURNING id INTO v_ajuste_id;

  RETURN v_ajuste_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_ajuste_pieza       TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_ajuste_inventario   TO authenticated;

COMMENT ON FUNCTION registrar_ajuste_pieza IS
  'Ajuste de inventario para productos por pieza. '
  'SEGURIDAD: requiere rol dueño o administrador.';

-- ─────────────────────────────────────────────────────────────────────────────
-- M4: buscar_usuario_por_email — restringir a dueños
-- Antes: cualquier usuario autenticado podía enumerar emails del sistema.
-- Ahora: solo dueños de al menos un negocio (único caso de uso legítimo).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION buscar_usuario_por_email(p_email text)
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere autenticación.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios_negocio
    WHERE  user_id = auth.uid() AND rol = 'dueno'
  ) THEN
    RAISE EXCEPTION 'Solo el dueño de un negocio puede buscar usuarios por correo.';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email::text
    FROM   auth.users u
    WHERE  u.email = lower(trim(p_email))
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION buscar_usuario_por_email IS
  'Busca un usuario por email para agregarlo como empleado. '
  'SEGURIDAD: solo dueños de negocio pueden invocarla — previene enumeración de usuarios.';

-- ─────────────────────────────────────────────────────────────────────────────
-- B4: temas_estacionales — policy usa subquery directo a superadmins
-- (que tiene RLS sin policies → retorna false siempre para usuarios normales).
-- Reemplazar con es_superadmin() SECURITY DEFINER, que sí puede leer la tabla.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "temas_superadmin_write" ON temas_estacionales;

CREATE POLICY "temas_superadmin_write" ON temas_estacionales
  FOR ALL
  USING     (es_superadmin())
  WITH CHECK (es_superadmin());
