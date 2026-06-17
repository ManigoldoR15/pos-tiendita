-- =============================================================================
-- MIGRACIÓN 012: Lotes integrados al flujo de inventario (FEFO)
--
-- Objetivo: eliminar el doble trabajo entre alta de producto y captura de
-- caducidad. El stock de un producto pasa a ser, siempre, la suma de sus
-- lotes activos — no un contador independiente.
--
-- Cambios:
--   1. lotes_producto.cantidad_actual — lo que queda del lote (se consume
--      en ventas y se restituye al anular). cantidad sigue siendo lo recibido.
--   2. lotes_producto.fecha_caducidad ahora es NULLABLE — permite registrar
--      un lote sin fecha de caducidad rastreada (mercancía que al negocio no
--      le interesa monitorear). Esos lotes no aparecen en el semáforo.
--   3. lotes_producto.hora_recepcion — registro informativo, no afecta el
--      cálculo del semáforo (que sigue siendo por día).
--   4. Trigger sync_existencias_producto: cualquier alta/baja/cambio de un
--      lote recalcula productos.existencias = suma(cantidad_actual) de sus
--      lotes activos. Las pantallas (alta, reabasto, dar de baja) dejan de
--      tocar productos.existencias directamente.
--   5. Backfill: productos existentes sin ningún lote reciben un "lote
--      inicial" sintético con su existencias actual, sin fecha de caducidad,
--      para no perder inventario al activar el trigger.
--   6. venta_lotes — registra de qué lote(s) salió cada línea de venta, para
--      poder anular con precisión (PEPS: primero en caducar, primero en salir).
--   7. registrar_venta() y anular_venta() se reescriben para consumir/restituir
--      por lote en vez de tocar productos.existencias directamente.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas nuevas en lotes_producto
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE lotes_producto
  ADD COLUMN IF NOT EXISTS cantidad_actual integer,
  ADD COLUMN IF NOT EXISTS hora_recepcion  time;

ALTER TABLE lotes_producto ALTER COLUMN fecha_caducidad DROP NOT NULL;

-- Backfill cantidad_actual: lotes activos conservan su cantidad recibida
-- (nunca se ha consumido nada por lote todavía); lotes inactivos (ya dados
-- de baja / echados a perder) quedan en 0 — ya estaban fuera del inventario.
UPDATE lotes_producto
SET    cantidad_actual = CASE WHEN activo THEN cantidad ELSE 0 END
WHERE  cantidad_actual IS NULL;

ALTER TABLE lotes_producto
  ALTER COLUMN cantidad_actual SET NOT NULL,
  ALTER COLUMN cantidad_actual SET DEFAULT 0,
  ADD CONSTRAINT lotes_cantidad_actual_check CHECK (cantidad_actual >= 0);

COMMENT ON COLUMN lotes_producto.cantidad_actual IS
  'Unidades restantes del lote (se descuentan en ventas, se restituyen al anular). '
  'productos.existencias = suma de cantidad_actual de lotes activos (mantenido por trigger).';

COMMENT ON COLUMN lotes_producto.fecha_caducidad IS
  'NULL = lote sin caducidad rastreada (no aparece en el semáforo de /caducidad).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill: productos sin lotes reciben un lote inicial sintético
--    (preserva su existencias actual antes de que el trigger tome control)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO lotes_producto (
  negocio_id, producto_id, cantidad, cantidad_actual,
  fecha_recepcion, ubicacion, fecha_caducidad, notas, activo
)
SELECT
  p.negocio_id, p.id, p.existencias, p.existencias,
  CURRENT_DATE, 'ambiente', NULL,
  'Lote inicial migrado automáticamente (stock previo a control por lotes)',
  true
FROM productos p
WHERE p.existencias > 0
  AND NOT EXISTS (
    SELECT 1 FROM lotes_producto lp WHERE lp.producto_id = p.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: productos.existencias = suma de lotes activos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_existencias_producto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producto_id uuid;
BEGIN
  v_producto_id := COALESCE(NEW.producto_id, OLD.producto_id);

  UPDATE productos
  SET    existencias = (
           SELECT COALESCE(SUM(cantidad_actual), 0)
           FROM   lotes_producto
           WHERE  producto_id = v_producto_id
             AND  activo      = true
         ),
         updated_at = now()
  WHERE  id = v_producto_id;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION sync_existencias_producto() IS
  'Mantiene productos.existencias sincronizado con la suma de cantidad_actual '
  'de sus lotes activos. Única fuente de verdad: lotes_producto.';

DROP TRIGGER IF EXISTS trg_sync_existencias ON lotes_producto;
CREATE TRIGGER trg_sync_existencias
  AFTER INSERT OR UPDATE OR DELETE ON lotes_producto
  FOR EACH ROW
  EXECUTE FUNCTION sync_existencias_producto();

-- Recalcular existencias de todos los productos ahora que el backfill insertó
-- los lotes iniciales (cinturón y tirantes: deja todo consistente de entrada).
UPDATE productos p
SET    existencias = COALESCE((
         SELECT SUM(lp.cantidad_actual)
         FROM   lotes_producto lp
         WHERE  lp.producto_id = p.id
           AND  lp.activo      = true
       ), 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tabla venta_lotes — de qué lote salió cada línea de venta
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS venta_lotes (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_item_id  uuid    NOT NULL REFERENCES venta_items(id) ON DELETE CASCADE,
  lote_id        uuid    REFERENCES lotes_producto(id) ON DELETE SET NULL,
  cantidad       integer NOT NULL CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS idx_venta_lotes_item ON venta_lotes(venta_item_id);
CREATE INDEX IF NOT EXISTS idx_venta_lotes_lote ON venta_lotes(lote_id);

COMMENT ON TABLE venta_lotes IS
  'Detalle de qué lote(s) surtieron cada línea de venta (consumo PEPS por '
  'fecha de caducidad). Permite que anular_venta restituya al lote exacto.';

ALTER TABLE venta_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venta_lotes_ver"
  ON venta_lotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venta_items vi
      JOIN   ventas v ON v.id = vi.venta_id
      WHERE  vi.id = venta_lotes.venta_item_id
        AND  es_miembro_del_negocio(v.negocio_id)
    )
  );

-- INSERT/UPDATE/DELETE solo vía RPC (SECURITY DEFINER): sin policies de
-- escritura para clientes — igual que venta_items.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. registrar_venta() — consume lotes por orden de caducidad (FEFO)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_venta(
  p_negocio_id     uuid,
  p_items          jsonb,
  p_metodo_pago_id uuid,
  p_cliente_id     uuid    DEFAULT NULL,
  p_pago_recibido  integer DEFAULT NULL,
  p_descuento      integer DEFAULT 0
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
    total, pago_recibido, cambio, corte_id, estado, descuento
  ) VALUES (
    p_negocio_id, p_cliente_id, p_metodo_pago_id,
    v_total, p_pago_recibido, v_cambio, v_corte_id, 'completada', p_descuento
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

COMMENT ON FUNCTION registrar_venta(uuid, jsonb, uuid, uuid, integer, integer) IS
  'Registra una venta con descuento opcional. Valida stock, inserta venta + items '
  'con precio snapshot, y consume lotes en orden FEFO (primero en caducar, primero '
  'en salir) registrando el detalle en venta_lotes. productos.existencias se '
  'actualiza solo mediante el trigger de lotes_producto.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. anular_venta() — restituye a los lotes exactos vía venta_lotes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION anular_venta(p_venta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id uuid;
  v_estado     text;
  v_item       RECORD;
  v_vl         RECORD;
  v_restituido integer;
  v_faltante   integer;
  v_updated    integer;
BEGIN
  SELECT negocio_id, estado
  INTO   v_negocio_id, v_estado
  FROM   ventas
  WHERE  id = p_venta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  IF NOT es_dueno_del_negocio(v_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño del negocio puede anular ventas.';
  END IF;

  IF v_estado <> 'completada' THEN
    RAISE EXCEPTION 'La venta ya fue anulada o no está en estado completada';
  END IF;

  -- Por cada línea de venta, restituir a los lotes exactos de donde salió.
  FOR v_item IN
    SELECT id, producto_id, cantidad
    FROM   venta_items
    WHERE  venta_id = p_venta_id
  LOOP
    v_restituido := 0;

    FOR v_vl IN
      SELECT lote_id, cantidad
      FROM   venta_lotes
      WHERE  venta_item_id = v_item.id
    LOOP
      IF v_vl.lote_id IS NOT NULL THEN
        UPDATE lotes_producto
        SET    cantidad_actual = cantidad_actual + v_vl.cantidad,
               updated_at      = now()
        WHERE  id = v_vl.lote_id;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
      ELSE
        v_updated := 0;
      END IF;

      IF v_updated > 0 THEN
        v_restituido := v_restituido + v_vl.cantidad;
      ELSE
        -- El lote original ya no existe (eliminado) — crear lote de
        -- restitución para no perder el inventario devuelto.
        INSERT INTO lotes_producto (
          negocio_id, producto_id, cantidad, cantidad_actual,
          fecha_recepcion, ubicacion, fecha_caducidad, notas, activo
        ) VALUES (
          v_negocio_id, v_item.producto_id, v_vl.cantidad, v_vl.cantidad,
          CURRENT_DATE, 'ambiente', NULL,
          'Restitución por anulación de venta (lote original ya no existe)',
          true
        );
        v_restituido := v_restituido + v_vl.cantidad;
      END IF;
    END LOOP;

    -- Venta legacy (anterior a esta migración, sin venta_lotes) o consumo
    -- parcial sin registrar: el resto se restituye en un lote nuevo.
    v_faltante := v_item.cantidad - v_restituido;
    IF v_faltante > 0 THEN
      INSERT INTO lotes_producto (
        negocio_id, producto_id, cantidad, cantidad_actual,
        fecha_recepcion, ubicacion, fecha_caducidad, notas, activo
      ) VALUES (
        v_negocio_id, v_item.producto_id, v_faltante, v_faltante,
        CURRENT_DATE, 'ambiente', NULL,
        'Restitución por anulación de venta (venta previa al control por lotes)',
        true
      );
    END IF;
  END LOOP;

  UPDATE ventas
  SET    estado = 'cancelada'
  WHERE  id = p_venta_id;
END;
$$;

COMMENT ON FUNCTION anular_venta(uuid) IS
  'Cancela una venta completada y restituye el inventario al lote exacto de '
  'donde salió (vía venta_lotes). Si el lote ya no existe, o la venta es '
  'anterior al control por lotes, crea un lote de restitución sin fecha de '
  'caducidad para no perder inventario.';
