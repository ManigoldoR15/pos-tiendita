-- =============================================================================
-- 063_variantes_producto.sql — Variantes de producto (talla/color, etc.)
--
-- Para giros como ropa: un producto ("Playera polo") tiene variantes por 1-2
-- atributos definibles (Talla / Color), cada una con sus propias existencias.
-- Diseño: la variante es una DIMENSIÓN de lotes_producto — el inventario sigue
-- viviendo en lotes (FEFO, plazas, transferencias y anulaciones funcionan sin
-- cambios). variantes_producto.existencias es un espejo sincronizado por
-- trigger, igual que productos.existencias.
--
-- Un producto sin variantes (tiene_variantes = false) se comporta EXACTAMENTE
-- igual que antes de esta migración.
-- =============================================================================

-- ─── 1. productos: banderas de variantes ─────────────────────────────────────

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tiene_variantes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS atributo1 text,
  ADD COLUMN IF NOT EXISTS atributo2 text;

COMMENT ON COLUMN productos.atributo1 IS 'Nombre del primer atributo de variante (p.ej. "Talla")';
COMMENT ON COLUMN productos.atributo2 IS 'Nombre del segundo atributo, opcional (p.ej. "Color")';

-- ─── 2. variantes_producto ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS variantes_producto (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto_id   uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  valor1        text NOT NULL,          -- p.ej. "M"
  valor2        text,                   -- p.ej. "Rojo" (NULL si solo hay 1 atributo)
  codigo_barras text,
  existencias   numeric(12,3) NOT NULL DEFAULT 0,  -- espejo de SUM(lotes)
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS variantes_producto_combo_uq
  ON variantes_producto (producto_id, valor1, COALESCE(valor2, ''));
CREATE INDEX IF NOT EXISTS variantes_producto_negocio_idx  ON variantes_producto (negocio_id);
CREATE INDEX IF NOT EXISTS variantes_producto_producto_idx ON variantes_producto (producto_id);

ALTER TABLE variantes_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variantes_todo" ON variantes_producto
  USING      (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- ─── 3. lotes_producto: dimensión variante ───────────────────────────────────

ALTER TABLE lotes_producto
  ADD COLUMN IF NOT EXISTS variante_id uuid REFERENCES variantes_producto(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS lotes_producto_variante_idx
  ON lotes_producto (variante_id) WHERE variante_id IS NOT NULL;

-- ─── 4. venta_items: qué variante se vendió ──────────────────────────────────
-- variante_texto es snapshot ("M / Rojo") para que el historial y el ticket
-- sobrevivan aunque la variante se borre después.

ALTER TABLE venta_items
  ADD COLUMN IF NOT EXISTS variante_id uuid REFERENCES variantes_producto(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variante_texto text;

-- ─── 5. Sync de existencias por variante ─────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_existencias_variante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variante_id uuid;
BEGIN
  v_variante_id := COALESCE(NEW.variante_id, OLD.variante_id);
  IF v_variante_id IS NOT NULL THEN
    UPDATE variantes_producto
    SET    existencias = (
             SELECT COALESCE(SUM(cantidad_actual), 0)
             FROM   lotes_producto
             WHERE  variante_id = v_variante_id AND activo = true
           ),
           updated_at = now()
    WHERE  id = v_variante_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_existencias_variante ON lotes_producto;
CREATE TRIGGER trg_sync_existencias_variante
AFTER INSERT OR UPDATE OR DELETE ON lotes_producto
FOR EACH ROW EXECUTE FUNCTION sync_existencias_variante();

-- ─── 6. registrar_venta: acepta variante_id por item ─────────────────────────
-- Cada item del jsonb puede traer "variante_id". Si el producto tiene variantes
-- es OBLIGATORIA; el stock se valida y consume solo de los lotes de esa
-- variante (respetando la plaza si aplica). Sin variante_id el comportamiento
-- es idéntico a la versión anterior (033).

CREATE OR REPLACE FUNCTION registrar_venta(
  p_negocio_id     uuid,
  p_items          jsonb,
  p_metodo_pago_id uuid,
  p_cliente_id     uuid    DEFAULT NULL,
  p_pago_recibido  integer DEFAULT NULL,
  p_descuento      integer DEFAULT 0,
  p_vendedor_id    uuid    DEFAULT NULL,
  p_local_id       uuid    DEFAULT NULL
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
  v_variante_id       uuid;
  v_variante_texto    text;
  v_var               RECORD;
  v_cantidad          numeric(12,3);
  v_precio            integer;
  v_precio_normal     integer;
  v_existencias       numeric(12,3);
  v_existencias_disp  numeric(12,3);
  v_nombre_prod       text;
  v_tiene_variantes   boolean;
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

  -- ── Pasada 1: bloquear filas, validar stock, calcular totales ──────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id       := (v_item->>'producto_id')::uuid;
    v_variante_id   := NULLIF(v_item->>'variante_id', '')::uuid;
    v_cantidad      := (v_item->>'cantidad')::numeric;
    v_es_fiado_item := COALESCE((v_item->>'es_fiado')::boolean, false);

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %.', v_prod_id;
    END IF;

    SELECT nombre, precio_venta, existencias, tiene_variantes
    INTO   v_nombre_prod, v_precio, v_existencias, v_tiene_variantes
    FROM   productos
    WHERE  id         = v_prod_id
      AND  negocio_id = p_negocio_id
      AND  activo     = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo: %.', v_prod_id;
    END IF;

    IF v_tiene_variantes AND v_variante_id IS NULL THEN
      RAISE EXCEPTION 'El producto "%" requiere elegir una variante (talla/color).', v_nombre_prod;
    END IF;

    IF v_variante_id IS NOT NULL THEN
      -- Lock de la variante (serializa concurrencia por variante)
      SELECT id, valor1, valor2
      INTO   v_var
      FROM   variantes_producto
      WHERE  id          = v_variante_id
        AND  producto_id = v_prod_id
        AND  negocio_id  = p_negocio_id
        AND  activo      = true
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante no encontrada o inactiva para "%".', v_nombre_prod;
      END IF;

      SELECT COALESCE(SUM(cantidad_actual), 0)
      INTO   v_existencias_disp
      FROM   lotes_producto
      WHERE  producto_id = v_prod_id
        AND  variante_id = v_variante_id
        AND  activo      = true
        AND  (p_local_id IS NULL OR local_id = p_local_id);

      IF v_existencias_disp < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para "%" (% %). Disponible: %, solicitado: %.',
          v_nombre_prod, v_var.valor1, COALESCE('/ ' || v_var.valor2, ''),
          v_existencias_disp, v_cantidad;
      END IF;
    ELSIF p_local_id IS NOT NULL THEN
      SELECT COALESCE(SUM(cantidad_actual), 0)
      INTO   v_existencias_disp
      FROM   lotes_producto
      WHERE  producto_id = v_prod_id
        AND  local_id    = p_local_id
        AND  activo      = true;

      IF v_existencias_disp < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente en esta plaza para "%". Disponible en plaza: %, solicitado: %.',
          v_nombre_prod, v_existencias_disp, v_cantidad;
      END IF;
    ELSE
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
    v_variante_id   := NULLIF(v_item->>'variante_id', '')::uuid;
    v_cantidad      := (v_item->>'cantidad')::numeric;
    v_es_fiado_item := COALESCE((v_item->>'es_fiado')::boolean, false);

    SELECT nombre, precio_venta
    INTO   v_nombre_prod, v_precio
    FROM   productos
    WHERE  id = v_prod_id;

    v_variante_texto := NULL;
    IF v_variante_id IS NOT NULL THEN
      SELECT valor1 || COALESCE(' / ' || valor2, '')
      INTO   v_variante_texto
      FROM   variantes_producto
      WHERE  id = v_variante_id;
    END IF;

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
      (venta_id, producto_id, cantidad, precio_unitario, subtotal, es_fiado, precio_normal, variante_id, variante_texto)
    VALUES
      (v_venta_id, v_prod_id, v_cantidad, v_precio, v_subtotal, v_es_fiado_item, v_precio_normal, v_variante_id, v_variante_texto)
    RETURNING id INTO v_venta_item_id;

    -- FEFO: filtra por plaza y/o variante cuando aplican
    v_restante := v_cantidad;

    FOR v_lote IN
      SELECT id, cantidad_actual
      FROM   lotes_producto
      WHERE  producto_id    = v_prod_id
        AND  activo         = true
        AND  cantidad_actual > 0
        AND  (p_local_id IS NULL OR local_id = p_local_id)
        AND  (v_variante_id IS NULL OR variante_id = v_variante_id)
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
  'Registra una venta. Cada item puede traer variante_id (obligatoria si el '
  'producto tiene_variantes): el stock se valida y consume solo de los lotes de '
  'esa variante. Sin variante_id el comportamiento es idéntico a la versión 033.';
