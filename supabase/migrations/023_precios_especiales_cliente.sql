-- ============================================================
-- 023_precios_especiales_cliente.sql
-- Precios especiales por cliente: descuento por producto (%)
-- o monto fijo, auto-aplicado al seleccionar el cliente en POS.
-- ============================================================

-- 1. Tabla principal
CREATE TABLE IF NOT EXISTS precios_especiales_cliente (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  uuid        NOT NULL REFERENCES negocios(id)   ON DELETE CASCADE,
  cliente_id  uuid        NOT NULL REFERENCES clientes(id)   ON DELETE CASCADE,
  producto_id uuid        NOT NULL REFERENCES productos(id)  ON DELETE CASCADE,
  tipo        text        NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo')),
  valor       integer     NOT NULL CHECK (
    (tipo = 'porcentaje' AND valor BETWEEN 1 AND 9999) OR
    (tipo = 'monto_fijo' AND valor > 0)
  ),
  -- porcentaje: basis points (1250 = 12.50%).  monto_fijo: centavos ($10 off = 1000).
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, cliente_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_pec_negocio  ON precios_especiales_cliente(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pec_cliente  ON precios_especiales_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pec_producto ON precios_especiales_cliente(producto_id);

CREATE TRIGGER trg_pec_updated_at
  BEFORE UPDATE ON precios_especiales_cliente
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

ALTER TABLE precios_especiales_cliente ENABLE ROW LEVEL SECURITY;

-- Todos los miembros pueden VER (cajero los necesita en POS)
CREATE POLICY "pec_ver"
  ON precios_especiales_cliente FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

-- Solo dueño/admin crean, editan, borran
CREATE POLICY "pec_gestionar"
  ON precios_especiales_cliente FOR ALL
  USING (es_admin_o_dueno_del_negocio(negocio_id))
  WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

-- 2. precio_normal en venta_items
-- NULL  = se cobró precio normal
-- !NULL = precio original antes del precio especial (para calcular margen)
ALTER TABLE venta_items
  ADD COLUMN IF NOT EXISTS precio_normal integer;

-- 3. registrar_venta — misma firma de 7 parámetros, actualizada para:
--    · cantidades numeric(12,3) (granel, migración 016)
--    · precio especial por cliente (lookup automático)
--    · precio_normal grabado en venta_items cuando aplique
DROP FUNCTION IF EXISTS registrar_venta(uuid, jsonb, uuid, uuid, integer, integer, uuid);

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
  v_venta_id       uuid;
  v_venta_item_id  uuid;
  v_total          integer        := 0;
  v_total_fiado    integer        := 0;
  v_monto_pagar    integer;
  v_cambio         integer;
  v_corte_id       uuid;
  v_item           jsonb;
  v_prod_id        uuid;
  v_cantidad       numeric(12,3);
  v_precio         integer;
  v_precio_normal  integer;
  v_existencias    numeric(12,3);
  v_nombre_prod    text;
  v_subtotal       integer;
  v_es_fiado_item  boolean;
  v_restante       numeric(12,3);
  v_tomar          numeric(12,3);
  v_lote           RECORD;
  v_en_lista_negra boolean;
  v_motivo_negra   text;
  v_tipo_esp       text;
  v_valor_esp      integer;
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

  -- ── Pasada 1: bloquear filas de producto, validar stock, calcular totales ─────
  -- FOR UPDATE serializa contra operaciones concurrentes de lotes.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id       := (v_item->>'producto_id')::uuid;
    v_cantidad      := (v_item->>'cantidad')::numeric;
    v_es_fiado_item := COALESCE((v_item->>'es_fiado')::boolean, false);

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

    -- Precio especial por cliente (lookup en precios_especiales_cliente)
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

  -- ── Validaciones de fiado ──────────────────────────────────────────────────────
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
    total, pago_recibido, cambio, corte_id, estado, descuento, vendedor_id, es_fiado
  ) VALUES (
    p_negocio_id, p_cliente_id, p_metodo_pago_id,
    v_total, p_pago_recibido, v_cambio, v_corte_id, 'completada', p_descuento, p_vendedor_id,
    v_total_fiado > 0
  )
  RETURNING id INTO v_venta_id;

  -- ── Pasada 2: insertar venta_items con precio_normal, consumir lotes FEFO ─────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id       := (v_item->>'producto_id')::uuid;
    v_cantidad      := (v_item->>'cantidad')::numeric;
    v_es_fiado_item := COALESCE((v_item->>'es_fiado')::boolean, false);

    SELECT nombre, precio_venta
    INTO   v_nombre_prod, v_precio
    FROM   productos
    WHERE  id = v_prod_id;

    -- Re-aplicar precio especial (misma lógica que Pasada 1)
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

    -- Consumir lotes en orden FEFO
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
  'Registra una venta con soporte completo: descuento global, vendedor, fiado por línea, '
  'consumo de lotes FEFO (cantidades numeric 12,3 para granel) y precios especiales por '
  'cliente (lookup automático en precios_especiales_cliente). precio_normal en venta_items '
  'queda NOT NULL solo cuando se aplicó precio especial, permitiendo análisis de margen.';
