-- =============================================================================
-- 068_gate_modulo_apartados.sql — gating del módulo de paga 'apartados' en RPC
--
-- Igual que crear_entrega_repartidor valida 'repartidores', crear_apartado
-- ahora exige que el módulo esté activo — si no, un cliente técnico podría
-- usar apartados sin pagarlos llamando la RPC directo (la UI ya lo gatea con
-- requireModulo, pero la API no lo hacía). El módulo solo lo activa el
-- superadmin (actualizar_modulos_negocio es superadmin-only), así que este
-- check cierra el hueco de monetización sin abrir uno de seguridad.
--
-- Solo cambia el cuerpo de crear_apartado (agrega el IF del módulo tras la
-- validación de membresía). El resto es idéntico a la 065. Regenerado con
-- pg_get_functiondef tras aplicar vía MCP.
-- =============================================================================

CREATE OR REPLACE FUNCTION crear_apartado(
  p_negocio_id     uuid,
  p_cliente_id     uuid,
  p_items          jsonb,
  p_anticipo       integer DEFAULT 0,
  p_metodo_pago_id uuid    DEFAULT NULL,
  p_fecha_limite   date    DEFAULT NULL,
  p_notas          text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_apartado_id     uuid;
  v_item_id         uuid;
  v_cliente_nombre  text;
  v_total           integer := 0;
  v_item            jsonb;
  v_prod_id         uuid;
  v_variante_id     uuid;
  v_variante_texto  text;
  v_cantidad        numeric(12,3);
  v_precio          integer;
  v_nombre_prod     text;
  v_tiene_variantes boolean;
  v_disp            numeric(12,3);
  v_restante        numeric(12,3);
  v_tomar           numeric(12,3);
  v_lote            RECORD;
BEGIN
  IF NOT es_miembro_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Sin acceso al negocio %.', p_negocio_id;
  END IF;
  -- Módulo de paga activo (lo activa solo el superadmin)
  IF COALESCE((SELECT modulos_habilitados->>'apartados' FROM negocios WHERE id = p_negocio_id), 'false') <> 'true' THEN
    RAISE EXCEPTION 'El módulo de apartados no está activo en este negocio.';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El apartado debe incluir al menos un producto.';
  END IF;
  IF COALESCE(p_anticipo, 0) < 0 THEN
    RAISE EXCEPTION 'El anticipo no puede ser negativo.';
  END IF;

  SELECT nombre INTO v_cliente_nombre
  FROM clientes WHERE id = p_cliente_id AND negocio_id = p_negocio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Un apartado necesita cliente.';
  END IF;

  INSERT INTO apartados (negocio_id, cliente_id, cliente_nombre, total, fecha_limite, notas, creado_por)
  VALUES (p_negocio_id, p_cliente_id, v_cliente_nombre, 0, p_fecha_limite, NULLIF(TRIM(COALESCE(p_notas,'')), ''), auth.uid())
  RETURNING id INTO v_apartado_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id     := (v_item->>'producto_id')::uuid;
    v_variante_id := NULLIF(v_item->>'variante_id', '')::uuid;
    v_cantidad    := (v_item->>'cantidad')::numeric;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida.';
    END IF;

    SELECT nombre, precio_venta, tiene_variantes
    INTO v_nombre_prod, v_precio, v_tiene_variantes
    FROM productos
    WHERE id = v_prod_id AND negocio_id = p_negocio_id AND activo = true
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo.';
    END IF;
    IF v_tiene_variantes AND v_variante_id IS NULL THEN
      RAISE EXCEPTION 'El producto "%" requiere elegir una variante.', v_nombre_prod;
    END IF;

    v_variante_texto := NULL;
    IF v_variante_id IS NOT NULL THEN
      SELECT valor1 || COALESCE(' / ' || valor2, '') INTO v_variante_texto
      FROM variantes_producto
      WHERE id = v_variante_id AND producto_id = v_prod_id AND negocio_id = p_negocio_id AND activo = true
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante no encontrada para "%".', v_nombre_prod;
      END IF;
    END IF;

    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_disp
    FROM lotes_producto
    WHERE producto_id = v_prod_id AND activo = true AND cantidad_actual > 0
      AND (v_variante_id IS NULL OR variante_id = v_variante_id);
    IF v_disp < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%"%. Disponible: %, solicitado: %.',
        v_nombre_prod, COALESCE(' (' || v_variante_texto || ')', ''), v_disp, v_cantidad;
    END IF;

    INSERT INTO apartado_items (apartado_id, producto_id, variante_id, nombre_producto, variante_texto, cantidad, precio_unitario, subtotal)
    VALUES (v_apartado_id, v_prod_id, v_variante_id, v_nombre_prod, v_variante_texto, v_cantidad, v_precio, ROUND(v_precio * v_cantidad)::integer)
    RETURNING id INTO v_item_id;

    v_total := v_total + ROUND(v_precio * v_cantidad)::integer;

    v_restante := v_cantidad;
    FOR v_lote IN
      SELECT id, cantidad_actual FROM lotes_producto
      WHERE producto_id = v_prod_id AND activo = true AND cantidad_actual > 0
        AND (v_variante_id IS NULL OR variante_id = v_variante_id)
      ORDER BY fecha_caducidad ASC NULLS LAST, fecha_recepcion ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_restante = 0;
      v_tomar := LEAST(v_restante, v_lote.cantidad_actual);
      UPDATE lotes_producto SET cantidad_actual = cantidad_actual - v_tomar, updated_at = now() WHERE id = v_lote.id;
      INSERT INTO apartado_lotes (apartado_item_id, lote_id, cantidad) VALUES (v_item_id, v_lote.id, v_tomar);
      v_restante := v_restante - v_tomar;
    END LOOP;
    IF v_restante > 0 THEN
      RAISE EXCEPTION 'Inconsistencia de stock en "%".', v_nombre_prod;
    END IF;
  END LOOP;

  UPDATE apartados SET total = v_total WHERE id = v_apartado_id;

  IF COALESCE(p_anticipo, 0) > 0 THEN
    INSERT INTO apartado_abonos (apartado_id, monto, metodo_pago_id, creado_por)
    VALUES (v_apartado_id, p_anticipo, p_metodo_pago_id, auth.uid());
    IF p_anticipo >= v_total THEN
      UPDATE apartados SET estado = 'liquidado', cerrado_en = now() WHERE id = v_apartado_id;
    END IF;
  END IF;

  RETURN v_apartado_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION crear_apartado(uuid,uuid,jsonb,integer,uuid,date,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION crear_apartado(uuid,uuid,jsonb,integer,uuid,date,text) TO authenticated;
