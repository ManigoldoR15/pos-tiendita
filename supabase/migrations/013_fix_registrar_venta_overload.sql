-- =============================================================================
-- MIGRACIÓN 013: Corrige overload duplicado de registrar_venta
--
-- Bug: la migración 012 recreó registrar_venta() con la firma de 6 parámetros
-- (sin p_vendedor_id), que migración 004 ya había eliminado a propósito para
-- evitar ambigüedad. Como CREATE OR REPLACE FUNCTION identifica la función por
-- firma completa (tipos de parámetros), esto NO reemplazó la función real de
-- 7 parámetros — creó una función hermana. Todas las llamadas existentes
-- (app y tests) pasan p_vendedor_id, así que seguían resolviendo a la versión
-- VIEJA (sin lotes/FEFO), mientras anular_venta (sí reemplazada correctamente)
-- ya esperaba venta_lotes. Resultado: ventas seguían descontando existencias
-- directamente sin tocar lotes_producto, y anular_venta no encontraba
-- venta_lotes, restituyendo vía el fallback de "lote sintético" — duplicando
-- inventario. Detectado por el test e2e d-anular-venta.spec.ts.
--
-- Fix: eliminar el overload equivocado de 6 parámetros y recrear la función
-- real de 7 parámetros (con p_vendedor_id) usando la lógica FEFO de 012.
-- =============================================================================

DROP FUNCTION IF EXISTS registrar_venta(uuid, jsonb, uuid, uuid, integer, integer);

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
  v_venta_id      uuid;
  v_venta_item_id uuid;
  v_total         integer := 0;
  v_cambio        integer;
  v_corte_id      uuid;
  v_item          jsonb;
  v_prod_id       uuid;
  v_cantidad      integer;
  v_precio        integer;
  v_existencias   integer;
  v_nombre_prod   text;
  v_subtotal      integer;
  v_restante      integer;
  v_tomar         integer;
  v_lote          RECORD;
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

  -- Pasada 1: validar stock (bloquea el renglón de producto, lo que también
  -- serializa contra cualquier alta/baja de lote concurrente: el trigger de
  -- sync de existencias actualiza este mismo renglón).
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
  WHERE  negocio_id = p_negocio_id
    AND  estado     = 'abierto'
  LIMIT 1;

  INSERT INTO ventas (
    negocio_id, cliente_id, metodo_pago_id,
    total, pago_recibido, cambio, corte_id, estado, descuento, vendedor_id
  ) VALUES (
    p_negocio_id, p_cliente_id, p_metodo_pago_id,
    v_total, p_pago_recibido, v_cambio, v_corte_id, 'completada', p_descuento, p_vendedor_id
  )
  RETURNING id INTO v_venta_id;

  -- Pasada 2: insertar items y consumir lotes en orden FEFO
  -- (primero en caducar, primero en salir; los sin fecha se consumen al final)
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id  := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;

    SELECT precio_venta INTO v_precio
    FROM   productos
    WHERE  id = v_prod_id;

    v_subtotal := v_precio * v_cantidad;

    INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (v_venta_id, v_prod_id, v_cantidad, v_precio, v_subtotal)
    RETURNING id INTO v_venta_item_id;

    v_restante := v_cantidad;

    FOR v_lote IN
      SELECT id, cantidad_actual
      FROM   lotes_producto
      WHERE  producto_id    = v_prod_id
        AND  activo         = true
        AND  cantidad_actual > 0
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

COMMENT ON FUNCTION registrar_venta(uuid, jsonb, uuid, uuid, integer, integer, uuid) IS
  'Registra una venta con descuento y vendedor opcionales. Valida stock, inserta '
  'venta + items con precio snapshot, y consume lotes en orden FEFO (primero en '
  'caducar, primero en salir) registrando el detalle en venta_lotes. '
  'productos.existencias se actualiza solo mediante el trigger de lotes_producto.';
