-- =============================================================================
-- 072_transferencias_inventario.sql — mover stock entre plazas (Fase C bis)
--
-- La migración 033 dejó transferir_inventario_plaza(), que trabaja por LOTE:
-- hay que saber qué lote mover y cuánto. Un dueño piensa en "mover 10 Cocas de
-- la Plaza Centro a la Plaza Mercado", no en lotes.
--
-- Cambios:
--   1. transferencias_inventario: bitácora de cada movimiento (quién, qué,
--      cuánto, de dónde a dónde). Solo la RPC escribe; nadie edita ni borra.
--   2. transferir_stock_plaza(): mueve una cantidad de un producto entre plazas
--      repartiéndola entre los lotes del origen en orden FEFO. Atómica: si no
--      alcanza el stock, no se mueve nada.
--
-- NULL en origen o destino = pool global (stock sin plaza asignada). Es el caso
-- de entrada más común: hoy todo el inventario vive en el pool, así que el
-- primer movimiento de cualquier negocio será pool → plaza.
--
-- transferir_inventario_plaza() NO se toca — sigue disponible con su firma.
-- El camino de venta (registrar_venta) no se toca en absoluto.
-- =============================================================================

-- ─── 1. Bitácora de transferencias ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transferencias_inventario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    uuid NOT NULL REFERENCES negocios(id)            ON DELETE CASCADE,
  producto_id   uuid NOT NULL REFERENCES productos(id)           ON DELETE CASCADE,
  variante_id   uuid          REFERENCES variantes_producto(id)  ON DELETE SET NULL,
  from_local_id uuid          REFERENCES locales(id)             ON DELETE SET NULL,
  to_local_id   uuid          REFERENCES locales(id)             ON DELETE SET NULL,
  cantidad      numeric(12,3) NOT NULL CHECK (cantidad > 0),
  user_id       uuid          REFERENCES auth.users(id)          ON DELETE SET NULL,
  notas         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE transferencias_inventario IS
  'Bitácora de movimientos de stock entre plazas. from/to NULL = pool global. '
  'Solo la escribe transferir_stock_plaza(); no hay INSERT/UPDATE/DELETE directo.';

CREATE INDEX IF NOT EXISTS idx_transferencias_negocio
  ON transferencias_inventario(negocio_id, created_at DESC);

ALTER TABLE transferencias_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transferencias_ver ON transferencias_inventario;
CREATE POLICY transferencias_ver ON transferencias_inventario
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

-- Sin políticas de INSERT/UPDATE/DELETE: la bitácora es inmutable desde la app.
REVOKE ALL ON transferencias_inventario FROM PUBLIC, anon;
GRANT SELECT ON transferencias_inventario TO authenticated;

-- ─── 2. transferir_stock_plaza ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION transferir_stock_plaza(
  p_negocio_id    uuid,
  p_producto_id   uuid,
  p_cantidad      numeric(12,3),
  p_from_local_id uuid DEFAULT NULL,   -- NULL = pool global
  p_to_local_id   uuid DEFAULT NULL,   -- NULL = pool global
  p_variante_id   uuid DEFAULT NULL,
  p_notas         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tiene_variantes boolean;
  v_nombre_prod     text;
  v_disponible      numeric(12,3);
  v_restante        numeric(12,3);
  v_tomar           numeric(12,3);
  v_lote_ids        uuid[];
  v_lote_id         uuid;
  v_lote            RECORD;
  v_transferencia   uuid;
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede transferir inventario entre plazas.';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a transferir debe ser mayor que cero.';
  END IF;

  IF p_from_local_id IS NOT DISTINCT FROM p_to_local_id THEN
    RAISE EXCEPTION 'El origen y el destino son el mismo lugar.';
  END IF;

  SELECT nombre, tiene_variantes
  INTO   v_nombre_prod, v_tiene_variantes
  FROM   productos
  WHERE  id = p_producto_id AND negocio_id = p_negocio_id AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado o inactivo.';
  END IF;

  IF v_tiene_variantes AND p_variante_id IS NULL THEN
    RAISE EXCEPTION 'Este producto maneja variantes: indica cuál vas a transferir.';
  END IF;

  IF p_variante_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM variantes_producto
    WHERE id = p_variante_id AND producto_id = p_producto_id AND negocio_id = p_negocio_id
  ) THEN
    RAISE EXCEPTION 'La variante no pertenece a este producto.';
  END IF;

  -- Las plazas deben existir, ser de este negocio y estar activas
  IF p_from_local_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locales WHERE id = p_from_local_id AND negocio_id = p_negocio_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'La plaza de origen no existe o no está activa en este negocio.';
  END IF;

  IF p_to_local_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locales WHERE id = p_to_local_id AND negocio_id = p_negocio_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'La plaza de destino no existe o no está activa en este negocio.';
  END IF;

  -- ── Lotes del origen en orden FEFO (caduca primero, sale primero) ──────────
  -- Se materializan los ids ANTES de mover nada: una transferencia parcial crea
  -- lotes nuevos en el destino y no deben entrar en este mismo recorrido.
  SELECT array_agg(id ORDER BY fecha_caducidad ASC NULLS LAST, fecha_recepcion ASC),
         COALESCE(SUM(cantidad_actual), 0)
  INTO   v_lote_ids, v_disponible
  FROM   lotes_producto
  WHERE  negocio_id  = p_negocio_id
    AND  producto_id = p_producto_id
    AND  activo      = true
    AND  cantidad_actual > 0
    AND  local_id IS NOT DISTINCT FROM p_from_local_id
    AND  variante_id IS NOT DISTINCT FROM p_variante_id;

  IF v_disponible < p_cantidad THEN
    RAISE EXCEPTION 'No hay suficiente "%" en el origen. Disponible: %, solicitado: %.',
      v_nombre_prod, v_disponible, p_cantidad;
  END IF;

  v_restante := p_cantidad;

  FOREACH v_lote_id IN ARRAY v_lote_ids
  LOOP
    EXIT WHEN v_restante = 0;

    SELECT id, producto_id, variante_id, cantidad_actual,
           fecha_caducidad, fecha_recepcion, ubicacion, notas
    INTO   v_lote
    FROM   lotes_producto
    WHERE  id = v_lote_id
    FOR UPDATE;

    CONTINUE WHEN v_lote.cantidad_actual <= 0;

    v_tomar := LEAST(v_restante, v_lote.cantidad_actual);

    IF v_tomar = v_lote.cantidad_actual THEN
      -- El lote entero se va: basta con reetiquetarlo
      UPDATE lotes_producto
      SET    local_id = p_to_local_id, updated_at = now()
      WHERE  id = v_lote.id;
    ELSE
      -- Parcial: se descuenta del origen y nace un lote en el destino
      UPDATE lotes_producto
      SET    cantidad_actual = cantidad_actual - v_tomar, updated_at = now()
      WHERE  id = v_lote.id;

      INSERT INTO lotes_producto (
        negocio_id, producto_id, variante_id, cantidad, cantidad_actual,
        fecha_recepcion, ubicacion, fecha_caducidad, local_id, notas, activo
      ) VALUES (
        p_negocio_id, v_lote.producto_id, v_lote.variante_id, v_tomar, v_tomar,
        v_lote.fecha_recepcion, v_lote.ubicacion, v_lote.fecha_caducidad,
        p_to_local_id, v_lote.notas, true
      );
    END IF;

    v_restante := v_restante - v_tomar;
  END LOOP;

  IF v_restante > 0 THEN
    RAISE EXCEPTION 'No se pudo completar la transferencia de "%": faltaron % unidades.',
      v_nombre_prod, v_restante;
  END IF;

  INSERT INTO transferencias_inventario (
    negocio_id, producto_id, variante_id, from_local_id, to_local_id,
    cantidad, user_id, notas
  ) VALUES (
    p_negocio_id, p_producto_id, p_variante_id, p_from_local_id, p_to_local_id,
    p_cantidad, auth.uid(), p_notas
  )
  RETURNING id INTO v_transferencia;

  RETURN v_transferencia;
END;
$$;

REVOKE EXECUTE ON FUNCTION transferir_stock_plaza(uuid, uuid, numeric, uuid, uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION transferir_stock_plaza(uuid, uuid, numeric, uuid, uuid, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION transferir_stock_plaza IS
  'Mueve una cantidad de un producto entre plazas (NULL = pool global), repartiéndola '
  'entre los lotes del origen en orden FEFO. Atómica: si el origen no tiene suficiente, '
  'lanza excepción y no mueve nada. Deja registro en transferencias_inventario. '
  'Solo el dueño. No altera productos.existencias: el total del negocio no cambia, '
  'solo cambia de plaza.';
