-- ── Fase 21: vendedor_id en ventas + función registrar_venta actualizada ──

-- 1. Columna vendedor_id en ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Drop la firma de 6 params para evitar ambigüedad
DROP FUNCTION IF EXISTS registrar_venta(uuid, jsonb, uuid, uuid, integer, integer);

-- 3. Recrear con p_vendedor_id opcional
CREATE OR REPLACE FUNCTION registrar_venta(
  p_negocio_id     uuid,
  p_items          jsonb,
  p_metodo_pago_id uuid,
  p_cliente_id     uuid    DEFAULT NULL,
  p_pago_recibido  integer DEFAULT NULL,
  p_descuento      integer DEFAULT 0,
  p_vendedor_id    uuid    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta_id    uuid;
  v_total       integer := 0;
  v_cambio      integer;
  v_corte_id    uuid;
  v_item        jsonb;
  v_prod_id     uuid;
  v_cantidad    integer;
  v_precio      integer;
  v_existencias integer;
  v_nombre_prod text;
  v_subtotal    integer;
BEGIN
  IF NOT es_miembro_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Sin acceso al negocio %.', p_negocio_id;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto.';
  END IF;

  IF p_descuento < 0 THEN
    RAISE EXCEPTION 'El descuento no puede ser negativo.';
  END IF;

  -- Pasada 1: validar stock y calcular subtotal
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id  := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %.', v_prod_id;
    END IF;

    SELECT nombre, precio_venta, existencias
    INTO   v_nombre_prod, v_precio, v_existencias
    FROM   productos
    WHERE  id         = v_prod_id
      AND  negocio_id = p_negocio_id
      AND  activo     = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo: %.', v_prod_id;
    END IF;

    IF v_existencias < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, solicitado: %.',
        v_nombre_prod, v_existencias, v_cantidad;
    END IF;

    v_total := v_total + (v_precio * v_cantidad);
  END LOOP;

  v_total := GREATEST(0, v_total - p_descuento);

  IF p_pago_recibido IS NOT NULL THEN
    IF p_pago_recibido < v_total THEN
      RAISE EXCEPTION 'Pago insuficiente. Total: %, recibido: %.', v_total, p_pago_recibido;
    END IF;
    v_cambio := p_pago_recibido - v_total;
  END IF;

  SELECT id INTO v_corte_id
  FROM   cortes_caja
  WHERE  negocio_id = p_negocio_id AND estado = 'abierto'
  LIMIT 1;

  INSERT INTO ventas (
    negocio_id, cliente_id, metodo_pago_id,
    total, pago_recibido, cambio, corte_id, estado, descuento, vendedor_id
  ) VALUES (
    p_negocio_id, p_cliente_id, p_metodo_pago_id,
    v_total, p_pago_recibido, v_cambio, v_corte_id, 'completada', p_descuento, p_vendedor_id
  )
  RETURNING id INTO v_venta_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id  := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;

    SELECT precio_venta INTO v_precio FROM productos WHERE id = v_prod_id;
    v_subtotal := v_precio * v_cantidad;

    INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (v_venta_id, v_prod_id, v_cantidad, v_precio, v_subtotal);

    UPDATE productos
    SET existencias = existencias - v_cantidad
    WHERE id = v_prod_id AND negocio_id = p_negocio_id;
  END LOOP;

  RETURN v_venta_id;
END;
$$;

-- 4. Función para listar miembros con email (SECURITY DEFINER accede a auth.users)
CREATE OR REPLACE FUNCTION get_miembros_negocio(p_negocio_id uuid)
RETURNS TABLE (user_id uuid, email text, rol rol_negocio, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT un.user_id, u.email, un.rol, un.created_at
  FROM public.usuarios_negocio un
  JOIN auth.users u ON u.id = un.user_id
  WHERE un.negocio_id = p_negocio_id
  ORDER BY un.rol DESC, un.created_at;  -- dueno primero
$$;

-- 5. Función para buscar usuario por email (para invitar)
CREATE OR REPLACE FUNCTION buscar_usuario_por_email(p_email text)
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id, email FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
$$;
