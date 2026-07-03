-- =============================================================================
-- MIGRACIÓN 040: registrar_compra crea lotes (arregla ventas bloqueadas)
--
-- Bug: registrar_compra (021) se escribió ignorando el sistema de lotes (012):
--   1. Hacía UPDATE directo de productos.existencias — pero desde 012 esa
--      columna la mantiene el trigger trg_sync_existencias como la suma de
--      cantidad_actual de los lotes activos, así que el stock agregado por
--      compras era "de papel": se esfumaba en el siguiente movimiento de lotes.
--   2. No creaba ningún lote — registrar_venta (FEFO, versión actual en 033)
--      surte por lotes, por lo que un producto reabastecido SOLO por compras
--      tronaba al venderse: "Inconsistencia de stock por lotes".
--
-- Arreglo (la VENTA no cambia; la COMPRA genera lotes vendibles):
--   1. registrar_compra inserta un lote por cada ítem (fecha_recepcion =
--      fecha de la compra, sin fecha de caducidad, sin plaza) y deja de
--      tocar productos.existencias — el trigger la recalcula solo.
--      Se conserva el costo promedio ponderado para precio_costo.
--   2. Regularización one-shot: productos cuyo existencias quedó por encima
--      de la suma de sus lotes activos (única causa: compras previas sin
--      lote) reciben un lote de regularización por la diferencia.
--
-- Limitaciones documentadas (a propósito, fuera de alcance de este fix):
--   - El form de compras no captura fecha de caducidad: los lotes de compra
--     nacen con fecha_caducidad = NULL (vendibles; FEFO los consume al final;
--     no aparecen en el semáforo de /caducidad). Si se quiere rastrear la
--     caducidad de una entrada, usar el flujo "Agregar lote".
--   - local_id = NULL: en negocios multi-plaza, una venta con plaza específica
--     no consume lotes sin plaza — igual que hoy; el form de compras no pide
--     plaza todavía.
--
-- Rollback: supabase/rollback/040_rollback_compras_crean_lotes.sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. registrar_compra — misma firma, ahora crea lotes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_compra(
  p_negocio_id   uuid,
  p_proveedor_id uuid,
  p_fecha        date,
  p_notas        text,
  p_items        jsonb        -- [{producto_id, cantidad, costo_unitario}]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra_id          uuid;
  v_item               jsonb;
  v_producto_id        uuid;
  v_cantidad           numeric(12,3);
  v_costo_unit         integer;
  v_subtotal           integer;
  v_total              integer := 0;
  v_existencias_antes  numeric(12,3);
  v_precio_costo_antes integer;
  v_nuevo_costo        integer;
BEGIN
  IF NOT es_admin_o_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede registrar compras.';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra debe tener al menos un producto.';
  END IF;

  -- Calcular total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cantidad   := (v_item->>'cantidad')::numeric;
    v_costo_unit := (v_item->>'costo_unitario')::integer;
    v_total      := v_total + ROUND(v_cantidad * v_costo_unit)::integer;
  END LOOP;

  -- Insertar cabecera
  INSERT INTO compras (negocio_id, proveedor_id, fecha, total, notas, registrado_por)
  VALUES (p_negocio_id, p_proveedor_id, p_fecha, v_total,
          NULLIF(TRIM(COALESCE(p_notas, '')), ''), auth.uid())
  RETURNING id INTO v_compra_id;

  -- Insertar ítems, crear lote por ítem y actualizar precio_costo
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::numeric;
    v_costo_unit  := (v_item->>'costo_unitario')::integer;
    v_subtotal    := ROUND(v_cantidad * v_costo_unit)::integer;

    SELECT existencias, precio_costo
    INTO   v_existencias_antes, v_precio_costo_antes
    FROM   productos
    WHERE  id = v_producto_id AND negocio_id = p_negocio_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado en este negocio.', v_producto_id;
    END IF;

    -- Costo promedio ponderado
    IF v_existencias_antes > 0 AND v_precio_costo_antes IS NOT NULL THEN
      v_nuevo_costo := ROUND(
        (v_existencias_antes * v_precio_costo_antes + v_cantidad * v_costo_unit)
        / (v_existencias_antes + v_cantidad)
      )::integer;
    ELSE
      v_nuevo_costo := v_costo_unit;
    END IF;

    INSERT INTO compras_items (compra_id, negocio_id, producto_id, cantidad, costo_unitario, subtotal)
    VALUES (v_compra_id, p_negocio_id, v_producto_id, v_cantidad, v_costo_unit, v_subtotal);

    -- Lote vendible por FEFO (sin caducidad rastreada, sin plaza).
    -- El trigger trg_sync_existencias recalcula productos.existencias.
    INSERT INTO lotes_producto (
      negocio_id, producto_id, cantidad, cantidad_actual,
      fecha_recepcion, ubicacion, fecha_caducidad, local_id, notas, activo
    ) VALUES (
      p_negocio_id, v_producto_id, v_cantidad, v_cantidad,
      p_fecha, 'ambiente', NULL, NULL,
      'Entrada por compra ' || v_compra_id, true
    );

    UPDATE productos
    SET precio_costo = v_nuevo_costo
    WHERE id = v_producto_id AND negocio_id = p_negocio_id;
  END LOOP;

  RETURN v_compra_id;
END;
$$;

COMMENT ON FUNCTION registrar_compra IS
  'Registra una entrada de mercancía: inserta compra + items, crea un lote '
  'por ítem (sin caducidad, vendible por FEFO) y actualiza precio_costo con '
  'promedio ponderado. productos.existencias la mantiene el trigger de lotes. '
  'Requiere rol dueño o administrador.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Regularización one-shot: stock fantasma de compras previas sin lote
--    (existencias > suma de lotes activos → lote por la diferencia)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO lotes_producto (
  negocio_id, producto_id, cantidad, cantidad_actual,
  fecha_recepcion, ubicacion, fecha_caducidad, notas, activo
)
SELECT
  p.negocio_id, p.id,
  p.existencias - COALESCE(l.suma, 0),
  p.existencias - COALESCE(l.suma, 0),
  CURRENT_DATE, 'ambiente', NULL,
  'Regularización: stock de compras registrado sin lote (migración 040)',
  true
FROM productos p
LEFT JOIN (
  SELECT producto_id, SUM(cantidad_actual) AS suma
  FROM   lotes_producto
  WHERE  activo = true
  GROUP BY producto_id
) l ON l.producto_id = p.id
WHERE p.existencias - COALESCE(l.suma, 0) > 0;

-- Normalizar existencias de todos los productos (los regularizados ya quedaron
-- por el trigger; esto deja consistente también cualquier divergencia negativa
-- residual, dejando a los lotes como única fuente de verdad).
UPDATE productos p
SET    existencias = COALESCE((
         SELECT SUM(lp.cantidad_actual)
         FROM   lotes_producto lp
         WHERE  lp.producto_id = p.id
           AND  lp.activo      = true
       ), 0)
WHERE  p.existencias <> COALESCE((
         SELECT SUM(lp.cantidad_actual)
         FROM   lotes_producto lp
         WHERE  lp.producto_id = p.id
           AND  lp.activo      = true
       ), 0);
