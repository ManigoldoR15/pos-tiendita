-- =============================================================================
-- ROLLBACK de MIGRACIÓN 040: restaura registrar_compra a su versión de 021
-- (UPDATE directo de existencias, sin crear lotes).
--
-- NOTA sobre datos: los lotes creados por compras/regularización NO se borran.
-- Son datos de inventario consistentes con el trigger trg_sync_existencias;
-- borrarlos haría desaparecer stock real (y romper ventas ya surtidas de esos
-- lotes vía venta_lotes). Este rollback solo revierte el COMPORTAMIENTO de
-- registrar_compra.
-- =============================================================================

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

  -- Insertar ítems y actualizar inventario
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

    UPDATE productos
    SET existencias  = existencias + v_cantidad,
        precio_costo = v_nuevo_costo
    WHERE id = v_producto_id AND negocio_id = p_negocio_id;
  END LOOP;

  RETURN v_compra_id;
END;
$$;

COMMENT ON FUNCTION registrar_compra IS
  'Registra una entrada de mercancía: inserta compra + items, incrementa existencias y actualiza precio_costo con promedio ponderado. Requiere rol dueño o administrador.';
