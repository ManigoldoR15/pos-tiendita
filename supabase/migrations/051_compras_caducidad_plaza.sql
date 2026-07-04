-- =============================================================================
-- 051_compras_caducidad_plaza.sql — Compras capturan caducidad y plaza
--
-- Resuelve la deuda documentada en 040: los lotes creados por
-- registrar_compra nacían con fecha_caducidad = NULL (fuera del semáforo
-- de /caducidad) y local_id = NULL (fuera de ventas con plaza específica).
--
-- Cambios:
--   - p_items acepta `caducidad` opcional por ítem (date) → fecha_caducidad
--     del lote; el semáforo de caducidad ya lo rastrea.
--   - +p_local_id opcional (plaza donde entra la mercancía, una por entrada);
--     se valida que pertenezca al negocio.
--   - Firma nueva de 6 parámetros; se elimina la de 5 para evitar ambigüedad
--     de sobrecarga en PostgREST.
-- =============================================================================

DROP FUNCTION IF EXISTS registrar_compra(uuid, uuid, date, text, jsonb);

CREATE FUNCTION registrar_compra(
  p_negocio_id   uuid,
  p_proveedor_id uuid,
  p_fecha        date,
  p_notas        text,
  p_items        jsonb,             -- [{producto_id, cantidad, costo_unitario, caducidad?}]
  p_local_id     uuid DEFAULT NULL  -- plaza de la entrada (opcional)
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
  v_caducidad          date;
BEGIN
  IF NOT es_admin_o_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede registrar compras.';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra debe tener al menos un producto.';
  END IF;

  IF p_local_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locales WHERE id = p_local_id AND negocio_id = p_negocio_id
  ) THEN
    RAISE EXCEPTION 'La plaza indicada no pertenece a este negocio.';
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
    v_caducidad   := NULLIF(v_item->>'caducidad', '')::date;

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

    -- Lote vendible por FEFO, ahora con caducidad y plaza rastreadas.
    -- El trigger trg_sync_existencias recalcula productos.existencias.
    INSERT INTO lotes_producto (
      negocio_id, producto_id, cantidad, cantidad_actual,
      fecha_recepcion, ubicacion, fecha_caducidad, local_id, notas, activo
    ) VALUES (
      p_negocio_id, v_producto_id, v_cantidad, v_cantidad,
      p_fecha, 'ambiente', v_caducidad, p_local_id,
      'Entrada por compra ' || v_compra_id, true
    );

    UPDATE productos
    SET precio_costo = v_nuevo_costo
    WHERE id = v_producto_id AND negocio_id = p_negocio_id;
  END LOOP;

  RETURN v_compra_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION registrar_compra(uuid, uuid, date, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_compra(uuid, uuid, date, text, jsonb, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION registrar_compra IS
  'Registra una entrada de mercancía: compra + items, un lote por ítem '
  '(con caducidad opcional por ítem y plaza opcional por entrada) y '
  'precio_costo con promedio ponderado. Requiere dueño o administrador.';
