-- =============================================================================
-- 065_apartados.sql — Módulo de apartados (layaway)
--
-- El cliente separa productos con anticipo y abona hasta liquidar. El stock se
-- RESERVA al apartar (consume lotes FEFO, igual que una venta) y se restaura
-- si se cancela. No genera venta: el dinero entra como abonos.
-- SQL recuperado de supabase_migrations.schema_migrations (aplicada vía MCP).
-- Nota: los REVOKE anon/PUBLIC de estas funciones (regla 049) van en la 066.
-- =============================================================================

CREATE TABLE apartados (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id     uuid REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nombre text NOT NULL,
  total          integer NOT NULL CHECK (total >= 0),
  estado         text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','liquidado','cancelado')),
  fecha_limite   date,
  notas          text,
  creado_por     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  cerrado_en     timestamptz
);
CREATE INDEX apartados_negocio_idx ON apartados (negocio_id, estado);

CREATE TABLE apartado_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartado_id     uuid NOT NULL REFERENCES apartados(id) ON DELETE CASCADE,
  producto_id     uuid REFERENCES productos(id) ON DELETE SET NULL,
  variante_id     uuid REFERENCES variantes_producto(id) ON DELETE SET NULL,
  nombre_producto text NOT NULL,
  variante_texto  text,
  cantidad        numeric(12,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario integer NOT NULL,
  subtotal        integer NOT NULL
);
CREATE INDEX apartado_items_apartado_idx ON apartado_items (apartado_id);

CREATE TABLE apartado_lotes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartado_item_id uuid NOT NULL REFERENCES apartado_items(id) ON DELETE CASCADE,
  lote_id          uuid REFERENCES lotes_producto(id) ON DELETE SET NULL,
  cantidad         numeric(12,3) NOT NULL
);

CREATE TABLE apartado_abonos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartado_id    uuid NOT NULL REFERENCES apartados(id) ON DELETE CASCADE,
  monto          integer NOT NULL CHECK (monto > 0),
  metodo_pago_id uuid REFERENCES metodos_pago(id) ON DELETE SET NULL,
  creado_por     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX apartado_abonos_apartado_idx ON apartado_abonos (apartado_id);

ALTER TABLE apartados       ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartado_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartado_lotes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartado_abonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apartados_todo" ON apartados
  USING (es_miembro_del_negocio(negocio_id)) WITH CHECK (es_miembro_del_negocio(negocio_id));
CREATE POLICY "apartado_items_todo" ON apartado_items
  USING (EXISTS (SELECT 1 FROM apartados a WHERE a.id = apartado_id AND es_miembro_del_negocio(a.negocio_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM apartados a WHERE a.id = apartado_id AND es_miembro_del_negocio(a.negocio_id)));
CREATE POLICY "apartado_lotes_todo" ON apartado_lotes
  USING (EXISTS (SELECT 1 FROM apartado_items i JOIN apartados a ON a.id = i.apartado_id WHERE i.id = apartado_item_id AND es_miembro_del_negocio(a.negocio_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM apartado_items i JOIN apartados a ON a.id = i.apartado_id WHERE i.id = apartado_item_id AND es_miembro_del_negocio(a.negocio_id)));
CREATE POLICY "apartado_abonos_todo" ON apartado_abonos
  USING (EXISTS (SELECT 1 FROM apartados a WHERE a.id = apartado_id AND es_miembro_del_negocio(a.negocio_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM apartados a WHERE a.id = apartado_id AND es_miembro_del_negocio(a.negocio_id)));

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

CREATE OR REPLACE FUNCTION abonar_apartado(
  p_apartado_id    uuid,
  p_monto          integer,
  p_metodo_pago_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ap RECORD;
  v_abonado integer;
BEGIN
  SELECT * INTO v_ap FROM apartados WHERE id = p_apartado_id FOR UPDATE;
  IF NOT FOUND OR NOT es_miembro_del_negocio(v_ap.negocio_id) THEN
    RAISE EXCEPTION 'Apartado no encontrado.';
  END IF;
  IF v_ap.estado <> 'activo' THEN
    RAISE EXCEPTION 'Este apartado ya está % — no admite abonos.', v_ap.estado;
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El abono debe ser mayor a cero.';
  END IF;

  INSERT INTO apartado_abonos (apartado_id, monto, metodo_pago_id, creado_por)
  VALUES (p_apartado_id, p_monto, p_metodo_pago_id, auth.uid());

  SELECT COALESCE(SUM(monto), 0) INTO v_abonado FROM apartado_abonos WHERE apartado_id = p_apartado_id;
  IF v_abonado >= v_ap.total THEN
    UPDATE apartados SET estado = 'liquidado', cerrado_en = now() WHERE id = p_apartado_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION cancelar_apartado(p_apartado_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ap RECORD;
  v_al RECORD;
BEGIN
  SELECT * INTO v_ap FROM apartados WHERE id = p_apartado_id FOR UPDATE;
  IF NOT FOUND OR NOT es_miembro_del_negocio(v_ap.negocio_id) THEN
    RAISE EXCEPTION 'Apartado no encontrado.';
  END IF;
  IF v_ap.estado <> 'activo' THEN
    RAISE EXCEPTION 'Solo se puede cancelar un apartado activo.';
  END IF;

  -- Devolver la mercancía a sus lotes originales (si el lote ya no existe, se omite)
  FOR v_al IN
    SELECT al.lote_id, al.cantidad
    FROM apartado_lotes al
    JOIN apartado_items ai ON ai.id = al.apartado_item_id
    WHERE ai.apartado_id = p_apartado_id AND al.lote_id IS NOT NULL
  LOOP
    UPDATE lotes_producto SET cantidad_actual = cantidad_actual + v_al.cantidad, updated_at = now()
    WHERE id = v_al.lote_id;
  END LOOP;

  UPDATE apartados SET estado = 'cancelado', cerrado_en = now() WHERE id = p_apartado_id;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_apartado TO authenticated;
GRANT EXECUTE ON FUNCTION abonar_apartado TO authenticated;
GRANT EXECUTE ON FUNCTION cancelar_apartado TO authenticated;
