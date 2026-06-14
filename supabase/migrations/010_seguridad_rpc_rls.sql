-- =============================================================================
-- MIGRACIÓN 010: Hardening de seguridad — RPC y RLS
--
-- PROBLEMA DETECTADO POR PRUEBAS E2E:
--   Las funciones RPC (anular_venta, cerrar_corte) y las políticas RLS de
--   varias tablas solo verifican membresía (cualquier rol), pero NO el rol
--   específico del usuario. Un empleado con token válido podía:
--     - Anular ventas vía API directa (vector de robo de efectivo)
--     - Cerrar/modificar cortes de caja
--     - Editar precios de productos
--     - Crear/eliminar gastos, metas, proveedores
--
-- SOLUCIÓN:
--   1. Nueva función helper: es_admin_o_dueno_del_negocio()
--   2. RPC anular_venta      → solo 'dueno'
--   3. RPC cerrar_corte      → 'dueno' o 'administrador'
--   4. RPC get_miembros_negocio → solo 'dueno'
--   5. RPC buscar_usuario_por_email → requiere auth.uid()
--   6. RLS granular por rol en:
--      productos, ventas, venta_items, cortes_caja, gastos,
--      metas, metodos_pago, categorias_producto, categorias_gasto, proveedores
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HELPER: es_admin_o_dueno_del_negocio
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION es_admin_o_dueno_del_negocio(negocio_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.usuarios_negocio
    WHERE  negocio_id = negocio_uuid
      AND  user_id    = auth.uid()
      AND  rol        IN ('dueno', 'administrador')
  );
$$;

COMMENT ON FUNCTION es_admin_o_dueno_del_negocio(uuid) IS
  'True si el usuario autenticado es dueño o administrador del negocio. '
  'SECURITY DEFINER para evitar recursión en policies RLS.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: anular_venta — SOLO dueño del negocio
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION anular_venta(p_venta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id uuid;
  v_estado     text;
BEGIN
  SELECT negocio_id, estado
  INTO   v_negocio_id, v_estado
  FROM   ventas
  WHERE  id = p_venta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- CAMBIO CRÍTICO: antes era es_miembro_del_negocio (cualquier rol).
  -- Ahora solo el dueño puede anular para prevenir robo de caja.
  IF NOT es_dueno_del_negocio(v_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño del negocio puede anular ventas.';
  END IF;

  IF v_estado <> 'completada' THEN
    RAISE EXCEPTION 'La venta ya fue anulada o no está en estado completada';
  END IF;

  UPDATE productos p
  SET    existencias = p.existencias + vi.cantidad
  FROM   venta_items vi
  WHERE  vi.venta_id   = p_venta_id
    AND  vi.producto_id = p.id;

  UPDATE ventas
  SET    estado = 'cancelada'
  WHERE  id = p_venta_id;
END;
$$;

COMMENT ON FUNCTION anular_venta(uuid) IS
  'Cancela una venta completada y restaura el inventario. '
  'SEGURIDAD: solo el dueño del negocio puede anular (previene robo de caja).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: cerrar_corte — dueño o administrador
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cerrar_corte(
  p_corte_id      uuid,
  p_monto_contado integer
)
RETURNS jsonb
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

  -- CAMBIO CRÍTICO: antes era es_miembro_del_negocio.
  -- Ahora requiere dueño o administrador (empleados no cierran caja).
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
    estado         = 'cerrado'
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

COMMENT ON FUNCTION cerrar_corte(uuid, integer) IS
  'Cierra un corte de caja. '
  'SEGURIDAD: requiere rol dueño o administrador del negocio.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: get_miembros_negocio — solo dueño
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_miembros_negocio(p_negocio_id uuid)
RETURNS TABLE (user_id uuid, email text, rol rol_negocio, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede ver la lista de miembros del negocio.';
  END IF;

  RETURN QUERY
    SELECT un.user_id, u.email::text, un.rol, un.created_at
    FROM public.usuarios_negocio un
    JOIN auth.users u ON u.id = un.user_id
    WHERE un.negocio_id = p_negocio_id
    ORDER BY un.rol DESC, un.created_at;
END;
$$;

COMMENT ON FUNCTION get_miembros_negocio(uuid) IS
  'Lista miembros del negocio con su email y rol. '
  'SEGURIDAD: solo el dueño puede invocarla (protege datos personales de empleados).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: buscar_usuario_por_email — requiere autenticación
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION buscar_usuario_por_email(p_email text)
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere autenticación para buscar usuarios.';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email::text
    FROM auth.users u
    WHERE u.email = lower(trim(p_email))
    LIMIT 1;
END;
$$;

-- =============================================================================
-- RLS: POLÍTICAS GRANULARES POR ROL
--
-- Patrón:
--   SELECT  → cualquier miembro del negocio
--   INSERT  → dueño o administrador (o dueño según tabla)
--   UPDATE  → dueño o administrador (o dueño según tabla)
--   DELETE  → solo dueño
--
-- NOTA: Las funciones SECURITY DEFINER (registrar_venta, anular_venta, etc.)
-- bypasean RLS, por lo que las restricciones en INSERT/UPDATE de ventas y
-- venta_items solo afectan llamadas directas al API.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- categorias_producto
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cat_producto_todo" ON categorias_producto;

CREATE POLICY "cat_prod_ver"        ON categorias_producto
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "cat_prod_insertar"   ON categorias_producto
  FOR INSERT WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "cat_prod_actualizar" ON categorias_producto
  FOR UPDATE USING (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "cat_prod_eliminar"   ON categorias_producto
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- productos  [CRÍTICO: empleados podían editar precios directamente]
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "productos_todo" ON productos;

CREATE POLICY "prod_ver"        ON productos
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "prod_insertar"   ON productos
  FOR INSERT WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

-- UPDATE también lo usan los RPCs SECURITY DEFINER (descuento de stock),
-- pero esos bypasean RLS. Aquí solo restringimos el UPDATE directo por API.
CREATE POLICY "prod_actualizar" ON productos
  FOR UPDATE USING (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "prod_eliminar"   ON productos
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- metodos_pago
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "metodos_pago_todo" ON metodos_pago;

CREATE POLICY "mp_ver"        ON metodos_pago
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "mp_insertar"   ON metodos_pago
  FOR INSERT WITH CHECK (es_dueno_del_negocio(negocio_id));

CREATE POLICY "mp_actualizar" ON metodos_pago
  FOR UPDATE USING (es_dueno_del_negocio(negocio_id));

CREATE POLICY "mp_eliminar"   ON metodos_pago
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- cortes_caja  [CRÍTICO: empleados podían abrir/cerrar caja y editar montos]
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cortes_caja_todo" ON cortes_caja;

CREATE POLICY "corte_ver"       ON cortes_caja
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "corte_abrir"     ON cortes_caja
  FOR INSERT WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "corte_actualizar" ON cortes_caja
  FOR UPDATE USING (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "corte_eliminar"  ON cortes_caja
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- ventas  [CRÍTICO: empleados podían cambiar estado directamente]
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ventas_todo" ON ventas;

CREATE POLICY "venta_ver"       ON ventas
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

-- INSERT directo: cualquier miembro (cajero puede registrar vía RPC o API).
-- El RPC registrar_venta (SECURITY DEFINER) bypasea RLS de todos modos.
CREATE POLICY "venta_insertar"  ON ventas
  FOR INSERT WITH CHECK (es_miembro_del_negocio(negocio_id));

-- UPDATE y DELETE: solo dueño. El RPC anular_venta (SECURITY DEFINER)
-- bypasea esta restricción, por lo que la función sigue funcionando.
CREATE POLICY "venta_actualizar" ON ventas
  FOR UPDATE USING (es_dueno_del_negocio(negocio_id));

CREATE POLICY "venta_eliminar"  ON ventas
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- venta_items  [empleados podían insertar/eliminar items directamente]
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT se mantiene (venta_items_ver).
-- INSERT y DELETE directos se eliminan — solo via SECURITY DEFINER RPCs.
-- ON DELETE CASCADE en venta_id no está afectado por RLS (FK constraints
-- corren con privilegios del sistema, bypasean RLS).

DROP POLICY IF EXISTS "venta_items_crear"    ON venta_items;
DROP POLICY IF EXISTS "venta_items_eliminar" ON venta_items;

-- ─────────────────────────────────────────────────────────────────────────────
-- categorias_gasto
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cat_gasto_todo" ON categorias_gasto;

CREATE POLICY "cat_gasto_ver"        ON categorias_gasto
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

-- El RPC crear_negocio (SECURITY DEFINER) bypasea RLS al sembrar categorías.
CREATE POLICY "cat_gasto_insertar"   ON categorias_gasto
  FOR INSERT WITH CHECK (es_dueno_del_negocio(negocio_id));

CREATE POLICY "cat_gasto_actualizar" ON categorias_gasto
  FOR UPDATE USING (es_dueno_del_negocio(negocio_id));

CREATE POLICY "cat_gasto_eliminar"   ON categorias_gasto
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- gastos  [CRÍTICO: empleados podían crear y eliminar gastos]
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "gastos_todo" ON gastos;

CREATE POLICY "gastos_ver"       ON gastos
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "gastos_insertar"  ON gastos
  FOR INSERT WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "gastos_actualizar" ON gastos
  FOR UPDATE USING (es_dueno_del_negocio(negocio_id));

CREATE POLICY "gastos_eliminar"  ON gastos
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- metas  [empleados podían ver y modificar metas de ventas]
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "metas_miembro" ON metas;

CREATE POLICY "metas_ver"        ON metas
  FOR SELECT USING (es_dueno_del_negocio(negocio_id));

CREATE POLICY "metas_insertar"   ON metas
  FOR INSERT WITH CHECK (es_dueno_del_negocio(negocio_id));

CREATE POLICY "metas_actualizar" ON metas
  FOR UPDATE USING (es_dueno_del_negocio(negocio_id));

CREATE POLICY "metas_eliminar"   ON metas
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- proveedores  [empleados podían ver y modificar proveedores]
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "proveedores_miembro" ON proveedores;

CREATE POLICY "proveedores_ver"        ON proveedores
  FOR SELECT USING (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "proveedores_insertar"   ON proveedores
  FOR INSERT WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "proveedores_actualizar" ON proveedores
  FOR UPDATE USING (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "proveedores_eliminar"   ON proveedores
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));
