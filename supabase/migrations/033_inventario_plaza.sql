-- =============================================================================
-- 033_inventario_plaza.sql — Inventario por plaza (Fase C)
--
-- Cambios:
--   1. lotes_producto.local_id (nullable) — asignación de lote a plaza
--   2. registrar_venta: +p_local_id opcional (default NULL) — FEFO por plaza
--   3. transferir_inventario_plaza(): mover stock entre plazas
--   4. get_stock_por_plaza(): vista de stock desglosada por plaza
-- =============================================================================

-- ─── 1. lotes_producto.local_id ──────────────────────────────────────────────
-- NULL = pool global (comportamiento actual sin cambio)
-- uuid = lote asignado a esa plaza

ALTER TABLE lotes_producto
  ADD COLUMN IF NOT EXISTS local_id uuid NULL REFERENCES locales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lotes_local ON lotes_producto(local_id);

COMMENT ON COLUMN lotes_producto.local_id IS
  'Plaza a la que pertenece este lote. NULL = pool global (disponible para cualquier venta '
  'sin filtro de plaza). Cuando se vende con p_local_id, FEFO solo consume lotes de esa plaza.';

-- ─── 2. registrar_venta — agregar p_local_id DEFAULT NULL ────────────────────
-- Debe DROP la firma exacta de 7 parámetros (migración 023) antes de recrear
-- con 8 parámetros.

DROP FUNCTION IF EXISTS registrar_venta(uuid, jsonb, uuid, uuid, integer, integer, uuid);

CREATE OR REPLACE FUNCTION registrar_venta(
  p_negocio_id     uuid,
  p_items          jsonb,
  p_metodo_pago_id uuid,
  p_cliente_id     uuid    DEFAULT NULL,
  p_pago_recibido  integer DEFAULT NULL,
  p_descuento      integer DEFAULT 0,
  p_vendedor_id    uuid    DEFAULT NULL,
  p_local_id       uuid    DEFAULT NULL   -- plaza del punto de venta
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta_id          uuid;
  v_venta_item_id     uuid;
  v_total             integer        := 0;
  v_total_fiado       integer        := 0;
  v_monto_pagar       integer;
  v_cambio            integer;
  v_corte_id          uuid;
  v_item              jsonb;
  v_prod_id           uuid;
  v_cantidad          numeric(12,3);
  v_precio            integer;
  v_precio_normal     integer;
  v_existencias       numeric(12,3);
  v_existencias_plaza numeric(12,3);
  v_nombre_prod       text;
  v_subtotal          integer;
  v_es_fiado_item     boolean;
  v_restante          numeric(12,3);
  v_tomar             numeric(12,3);
  v_lote              RECORD;
  v_en_lista_negra    boolean;
  v_motivo_negra      text;
  v_tipo_esp          text;
  v_valor_esp         integer;
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

  -- ── Pasada 1: bloquear filas de producto, validar stock, calcular totales ──
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id       := (v_item->>'producto_id')::uuid;
    v_cantidad      := (v_item->>'cantidad')::numeric;
    v_es_fiado_item := COALESCE((v_item->>'es_fiado')::boolean, false);

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %.', v_prod_id;
    END IF;

    -- Lock en la fila de producto (serializa concurrencia)
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

    -- Validación de stock (bifurcación por plaza)
    IF p_local_id IS NOT NULL THEN
      -- Multi-plaza: stock SOLO del lote de esta plaza
      SELECT COALESCE(SUM(cantidad_actual), 0)
      INTO   v_existencias_plaza
      FROM   lotes_producto
      WHERE  producto_id = v_prod_id
        AND  local_id    = p_local_id
        AND  activo      = true;

      IF v_existencias_plaza < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente en esta plaza para "%". Disponible en plaza: %, solicitado: %.',
          v_nombre_prod, v_existencias_plaza, v_cantidad;
      END IF;
    ELSE
      -- Sin plaza: verificar stock global (comportamiento IDÉNTICO a hoy)
      IF v_existencias < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, solicitado: %.',
          v_nombre_prod, v_existencias, v_cantidad;
      END IF;
    END IF;

    -- Precio especial por cliente
    IF p_cliente_id IS NOT NULL THEN
      SELECT tipo, valor INTO v_tipo_esp, v_valor_esp
      FROM   precios_especiales_cliente
      WHERE  negocio_id  = p_negocio_id
        AND  cliente_id  = p_cliente_id
        AND  producto_id = v_prod_id;

      IF FOUND THEN
        IF v_tipo_esp = 'porcentaje' THEN
          v_precio := GREATEST(0,
            ROUND(v_precio::numeric * (10000 - v_valor_esp) / 10000)::integer);
        ELSE
          v_precio := GREATEST(0, v_precio - v_valor_esp);
        END IF;
      END IF;
    END IF;

    v_total := v_total + ROUND(v_precio * v_cantidad)::integer;
    IF v_es_fiado_item THEN
      v_total_fiado := v_total_fiado + ROUND(v_precio * v_cantidad)::integer;
    END IF;
  END LOOP;

  v_total := GREATEST(0, v_total - p_descuento);

  -- ── Validaciones de fiado ─────────────────────────────────────────────────
  IF v_total_fiado > 0 THEN
    IF p_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Una venta fiada debe tener cliente.';
    END IF;

    SELECT en_lista_negra, motivo_lista_negra
    INTO   v_en_lista_negra, v_motivo_negra
    FROM   clientes
    WHERE  id = p_cliente_id AND negocio_id = p_negocio_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente no encontrado.';
    END IF;

    IF v_en_lista_negra THEN
      RAISE EXCEPTION 'Este cliente está en lista negra: %',
        COALESCE(v_motivo_negra, 'sin motivo especificado');
    END IF;
  END IF;

  v_monto_pagar := GREATEST(0, v_total - v_total_fiado);

  IF p_pago_recibido IS NOT NULL THEN
    IF p_pago_recibido < v_monto_pagar THEN
      RAISE EXCEPTION 'Pago insuficiente. A pagar: %, recibido: %.', v_monto_pagar, p_pago_recibido;
    END IF;
    v_cambio := p_pago_recibido - v_monto_pagar;
  END IF;

  SELECT id INTO v_corte_id
  FROM   cortes_caja
  WHERE  negocio_id = p_negocio_id
    AND  estado     = 'abierto'
  LIMIT 1;

  INSERT INTO ventas (
    negocio_id, cliente_id, metodo_pago_id,
    total, pago_recibido, cambio, corte_id, estado, descuento, vendedor_id, es_fiado, local_id
  ) VALUES (
    p_negocio_id, p_cliente_id, p_metodo_pago_id,
    v_total, p_pago_recibido, v_cambio, v_corte_id, 'completada', p_descuento, p_vendedor_id,
    v_total_fiado > 0, p_local_id
  )
  RETURNING id INTO v_venta_id;

  -- ── Pasada 2: insertar venta_items, consumir lotes FEFO ──────────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id       := (v_item->>'producto_id')::uuid;
    v_cantidad      := (v_item->>'cantidad')::numeric;
    v_es_fiado_item := COALESCE((v_item->>'es_fiado')::boolean, false);

    SELECT nombre, precio_venta
    INTO   v_nombre_prod, v_precio
    FROM   productos
    WHERE  id = v_prod_id;

    -- Re-aplicar precio especial
    v_precio_normal := NULL;
    IF p_cliente_id IS NOT NULL THEN
      SELECT tipo, valor INTO v_tipo_esp, v_valor_esp
      FROM   precios_especiales_cliente
      WHERE  negocio_id  = p_negocio_id
        AND  cliente_id  = p_cliente_id
        AND  producto_id = v_prod_id;

      IF FOUND THEN
        v_precio_normal := v_precio;
        IF v_tipo_esp = 'porcentaje' THEN
          v_precio := GREATEST(0,
            ROUND(v_precio::numeric * (10000 - v_valor_esp) / 10000)::integer);
        ELSE
          v_precio := GREATEST(0, v_precio - v_valor_esp);
        END IF;
      END IF;
    END IF;

    v_subtotal := ROUND(v_precio * v_cantidad)::integer;

    INSERT INTO venta_items
      (venta_id, producto_id, cantidad, precio_unitario, subtotal, es_fiado, precio_normal)
    VALUES
      (v_venta_id, v_prod_id, v_cantidad, v_precio, v_subtotal, v_es_fiado_item, v_precio_normal)
    RETURNING id INTO v_venta_item_id;

    -- FEFO: una sola condición filtra por plaza cuando p_local_id IS NOT NULL
    -- Cuando p_local_id IS NULL: (NULL IS NULL OR ...) = TRUE → todos los lotes pasan
    v_restante := v_cantidad;

    FOR v_lote IN
      SELECT id, cantidad_actual
      FROM   lotes_producto
      WHERE  producto_id    = v_prod_id
        AND  activo         = true
        AND  cantidad_actual > 0
        AND  (p_local_id IS NULL OR local_id = p_local_id)
      ORDER BY fecha_caducidad ASC NULLS LAST, fecha_recepcion ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_restante = 0;

      v_tomar := LEAST(v_restante, v_lote.cantidad_actual);

      UPDATE lotes_producto
      SET    cantidad_actual = cantidad_actual - v_tomar,
             updated_at      = now()
      WHERE  id = v_lote.id;

      INSERT INTO venta_lotes (venta_item_id, lote_id, cantidad)
      VALUES (v_venta_item_id, v_lote.id, v_tomar);

      v_restante := v_restante - v_tomar;
    END LOOP;

    IF v_restante > 0 THEN
      RAISE EXCEPTION
        'Inconsistencia de stock por lotes en "%": faltaron % unidades por surtir.',
        v_nombre_prod, v_restante;
    END IF;
  END LOOP;

  RETURN v_venta_id;
END;
$$;

COMMENT ON FUNCTION registrar_venta(uuid, jsonb, uuid, uuid, integer, integer, uuid, uuid) IS
  'Registra una venta. p_local_id DEFAULT NULL: cuando NULL, comportamiento idéntico a '
  'versiones anteriores (FEFO global, sin filtro de plaza). Cuando se pasa uuid de plaza, '
  'FEFO consume solo los lotes de esa plaza y registra local_id en la venta.';

-- ─── 3. transferir_inventario_plaza ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION transferir_inventario_plaza(
  p_negocio_id   uuid,
  p_lote_id      uuid,
  p_cantidad     numeric(12,3),
  p_to_local_id  uuid   -- NULL = devolver al pool global
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote      RECORD;
  v_nuevo_id  uuid;
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede transferir inventario entre plazas.';
  END IF;

  SELECT id, negocio_id, producto_id, cantidad_actual, local_id,
         fecha_caducidad, fecha_recepcion, precio_costo, notas
  INTO   v_lote
  FROM   lotes_producto
  WHERE  id         = p_lote_id
    AND  negocio_id = p_negocio_id
    AND  activo     = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado o inactivo.';
  END IF;

  IF p_cantidad <= 0 OR p_cantidad > v_lote.cantidad_actual THEN
    RAISE EXCEPTION 'Cantidad inválida: debe ser > 0 y ≤ disponible (%).', v_lote.cantidad_actual;
  END IF;

  IF p_to_local_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locales WHERE id = p_to_local_id AND negocio_id = p_negocio_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'La plaza destino no existe o no está activa en este negocio.';
  END IF;

  -- No-op si origen = destino
  IF (v_lote.local_id IS NOT DISTINCT FROM p_to_local_id) THEN
    RETURN p_lote_id;
  END IF;

  IF p_cantidad = v_lote.cantidad_actual THEN
    -- Lote completo: solo reasignar local_id
    UPDATE lotes_producto SET local_id = p_to_local_id, updated_at = now() WHERE id = p_lote_id;
    RETURN p_lote_id;
  ELSE
    -- Parcial: descontar origen, crear lote nuevo en destino
    UPDATE lotes_producto
    SET cantidad_actual = cantidad_actual - p_cantidad, updated_at = now()
    WHERE id = p_lote_id;

    INSERT INTO lotes_producto (
      negocio_id, producto_id, cantidad, cantidad_actual, local_id,
      fecha_caducidad, fecha_recepcion, precio_costo, notas
    ) VALUES (
      v_lote.negocio_id, v_lote.producto_id, p_cantidad, p_cantidad, p_to_local_id,
      v_lote.fecha_caducidad, v_lote.fecha_recepcion, v_lote.precio_costo, v_lote.notas
    )
    RETURNING id INTO v_nuevo_id;

    RETURN v_nuevo_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION transferir_inventario_plaza TO authenticated;

-- ─── 4. get_stock_por_plaza ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_stock_por_plaza(p_negocio_id uuid)
RETURNS TABLE(
  local_id        uuid,
  local_nombre    text,
  local_color     text,
  producto_id     uuid,
  producto_nombre text,
  unidad_medida   text,
  stock_plaza     numeric(12,3),
  num_lotes       bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede ver el stock por plaza.';
  END IF;

  RETURN QUERY
    SELECT
      l.id, l.nombre, l.color,
      p.id, p.nombre, p.unidad_medida,
      COALESCE(SUM(lp.cantidad_actual), 0)::numeric(12,3) AS stock_plaza,
      COUNT(lp.id)                                          AS num_lotes
    FROM locales l
    CROSS JOIN productos p
    LEFT JOIN lotes_producto lp
           ON lp.producto_id = p.id
          AND lp.local_id    = l.id
          AND lp.activo      = true
    WHERE l.negocio_id = p_negocio_id
      AND l.activo     = true
      AND p.negocio_id = p_negocio_id
      AND p.activo     = true
    GROUP BY l.id, l.nombre, l.color, p.id, p.nombre, p.unidad_medida
    HAVING COALESCE(SUM(lp.cantidad_actual), 0) > 0
    ORDER BY l.nombre, p.nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION get_stock_por_plaza TO authenticated;
