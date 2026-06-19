-- ============================================================
-- 021_compras.sql  —  Entradas de mercancía / compras a proveedores
-- ============================================================
-- Applied via MCP apply_migration on 2026-06-18

-- 1. Tabla cabecera de compra
CREATE TABLE IF NOT EXISTS compras (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  proveedor_id   uuid        REFERENCES proveedores(id) ON DELETE SET NULL,
  fecha          date        NOT NULL DEFAULT CURRENT_DATE,
  total          integer     NOT NULL DEFAULT 0 CHECK (total >= 0),
  notas          text,
  registrado_por uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_negocio   ON compras(negocio_id);
CREATE INDEX IF NOT EXISTS idx_compras_fecha     ON compras(negocio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(proveedor_id);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_ver"
  ON compras FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "compras_gestionar"
  ON compras FOR ALL
  USING (es_admin_o_dueno_del_negocio(negocio_id))
  WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

-- 2. Tabla ítems de compra
CREATE TABLE IF NOT EXISTS compras_items (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id      uuid           NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  negocio_id     uuid           NOT NULL REFERENCES negocios(id),
  producto_id    uuid           NOT NULL REFERENCES productos(id),
  cantidad       numeric(12,3)  NOT NULL CHECK (cantidad > 0),
  costo_unitario integer        NOT NULL CHECK (costo_unitario >= 0),
  subtotal       integer        NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_comp_items_compra   ON compras_items(compra_id);
CREATE INDEX IF NOT EXISTS idx_comp_items_producto ON compras_items(producto_id);

ALTER TABLE compras_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_items_ver"
  ON compras_items FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "compras_items_gestionar"
  ON compras_items FOR ALL
  USING (es_admin_o_dueno_del_negocio(negocio_id))
  WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

-- 3. RPC registrar_compra
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
