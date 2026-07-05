-- =============================================================================
-- 056_entregas_repartidor.sql — Entrega de carga a repartidores
--
-- Flujo:
--   1. Un empleado (o el dueño) registra cuánto inventario le entrega a un
--      repartidor. Al registrarla, ese stock SALE del inventario (FEFO), igual
--      que una venta — el dueño ve la mercancía irse en tiempo real.
--   2. El dueño ve todas las entregas y su valor.
--   3. El repartidor confirma que la recibió (o la rechaza). Al rechazar, el
--      inventario se restituye con un lote de devolución.
--   4. El repartidor sale a su ruta (rastreo GPS del módulo flotilla).
--
-- Todo el movimiento de inventario ocurre dentro de RPCs SECURITY DEFINER;
-- las tablas no tienen políticas de escritura directa.
-- =============================================================================

-- ─── Tablas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entregas_repartidor (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    uuid        NOT NULL REFERENCES negocios(id)   ON DELETE CASCADE,
  repartidor_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entregado_por uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  local_id      uuid                 REFERENCES locales(id)    ON DELETE SET NULL,
  estado        text        NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'confirmada', 'rechazada')),
  nota          text,
  nota_respuesta text,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  respondido_en timestamptz
);

CREATE INDEX IF NOT EXISTS idx_entregas_negocio     ON entregas_repartidor(negocio_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_entregas_repartidor  ON entregas_repartidor(repartidor_id, estado);

CREATE TABLE IF NOT EXISTS entregas_repartidor_items (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id      uuid    NOT NULL REFERENCES entregas_repartidor(id) ON DELETE CASCADE,
  producto_id     uuid    NOT NULL REFERENCES productos(id),
  nombre_producto text    NOT NULL,               -- snapshot al momento de la entrega
  cantidad        integer NOT NULL CHECK (cantidad > 0),
  costo_unitario  integer NOT NULL DEFAULT 0       -- centavos, para valuar la carga
);

CREATE INDEX IF NOT EXISTS idx_entregas_items_entrega ON entregas_repartidor_items(entrega_id);

-- ─── RLS: lectura para miembros; escritura solo vía RPC ──────────────────────

ALTER TABLE entregas_repartidor       ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas_repartidor_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entregas_select" ON entregas_repartidor;
CREATE POLICY "entregas_select" ON entregas_repartidor
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

DROP POLICY IF EXISTS "entregas_items_select" ON entregas_repartidor_items;
CREATE POLICY "entregas_items_select" ON entregas_repartidor_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM entregas_repartidor e
      WHERE e.id = entregas_repartidor_items.entrega_id
        AND es_miembro_del_negocio(e.negocio_id)
    )
  );

-- ─── RPC: crear entrega (empleado/dueño) — descuenta inventario FEFO ─────────

CREATE OR REPLACE FUNCTION crear_entrega_repartidor(
  p_negocio_id    uuid,
  p_repartidor_id uuid,
  p_items         jsonb,
  p_local_id      uuid DEFAULT NULL,
  p_nota          text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_caller  rol_negocio;
  v_rol_dest    rol_negocio;
  v_item        jsonb;
  v_prod_id     uuid;
  v_cantidad    integer;
  v_nombre      text;
  v_costo       integer;
  v_existencias integer;
  v_existe_plaza integer;
  v_restante    integer;
  v_tomar       integer;
  v_lote        RECORD;
  v_entrega_id  uuid;
BEGIN
  -- Módulo activo
  IF NOT EXISTS (
    SELECT 1 FROM negocios n
    WHERE n.id = p_negocio_id
      AND COALESCE(n.modulos_habilitados->>'repartidores', 'false') = 'true'
  ) THEN
    RAISE EXCEPTION 'El módulo de reparto no está activo en este negocio.';
  END IF;

  -- El que entrega debe ser dueño o empleado (un repartidor no carga a otro)
  SELECT un.rol INTO v_rol_caller
  FROM usuarios_negocio un
  WHERE un.negocio_id = p_negocio_id AND un.user_id = auth.uid();

  IF v_rol_caller IS NULL OR v_rol_caller NOT IN ('dueno', 'empleado') THEN
    RAISE EXCEPTION 'Solo el dueño o un empleado pueden entregar carga.';
  END IF;

  -- El destinatario debe ser repartidor del negocio
  SELECT un.rol INTO v_rol_dest
  FROM usuarios_negocio un
  WHERE un.negocio_id = p_negocio_id AND un.user_id = p_repartidor_id;

  IF v_rol_dest IS DISTINCT FROM 'repartidor' THEN
    RAISE EXCEPTION 'El destinatario no es un repartidor de este negocio.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La entrega debe incluir al menos un producto.';
  END IF;

  INSERT INTO entregas_repartidor (negocio_id, repartidor_id, entregado_por, local_id, nota)
  VALUES (p_negocio_id, p_repartidor_id, auth.uid(), p_local_id, NULLIF(TRIM(p_nota), ''))
  RETURNING id INTO v_entrega_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id  := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %.', v_prod_id;
    END IF;

    SELECT p.nombre, COALESCE(p.precio_costo, 0), p.existencias
    INTO   v_nombre, v_costo, v_existencias
    FROM   productos p
    WHERE  p.id = v_prod_id AND p.negocio_id = p_negocio_id AND p.activo = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo: %.', v_prod_id;
    END IF;

    -- Validar stock (por plaza si aplica, si no global)
    IF p_local_id IS NOT NULL THEN
      SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_existe_plaza
      FROM lotes_producto
      WHERE producto_id = v_prod_id AND local_id = p_local_id AND activo = true;

      IF v_existe_plaza < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente en esta plaza para "%". Disponible: %, se quiere entregar: %.',
          v_nombre, v_existe_plaza, v_cantidad;
      END IF;
    ELSIF v_existencias < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, se quiere entregar: %.',
        v_nombre, v_existencias, v_cantidad;
    END IF;

    -- FEFO: consumir lotes (misma lógica que una venta)
    v_restante := v_cantidad;
    FOR v_lote IN
      SELECT lp.id, lp.cantidad_actual
      FROM   lotes_producto lp
      WHERE  lp.producto_id     = v_prod_id
        AND  lp.activo          = true
        AND  lp.cantidad_actual > 0
        AND  (p_local_id IS NULL OR lp.local_id = p_local_id)
      ORDER BY lp.fecha_caducidad ASC NULLS LAST, lp.fecha_recepcion ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_restante = 0;
      v_tomar := LEAST(v_restante, v_lote.cantidad_actual);
      UPDATE lotes_producto
      SET    cantidad_actual = cantidad_actual - v_tomar, updated_at = now()
      WHERE  id = v_lote.id;
      v_restante := v_restante - v_tomar;
    END LOOP;

    IF v_restante > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para "%" al descontar lotes.', v_nombre;
    END IF;

    INSERT INTO entregas_repartidor_items (entrega_id, producto_id, nombre_producto, cantidad, costo_unitario)
    VALUES (v_entrega_id, v_prod_id, v_nombre, v_cantidad, v_costo);
  END LOOP;

  RETURN v_entrega_id;
END;
$$;

-- ─── RPC: el repartidor confirma o rechaza la carga ─────────────────────────

CREATE OR REPLACE FUNCTION responder_entrega_repartidor(
  p_entrega_id uuid,
  p_aceptar    boolean,
  p_nota       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega  RECORD;
  v_item     RECORD;
BEGIN
  SELECT * INTO v_entrega FROM entregas_repartidor WHERE id = p_entrega_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega no encontrada.';
  END IF;
  IF v_entrega.repartidor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo el repartidor de esta entrega puede responderla.';
  END IF;
  IF v_entrega.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta entrega ya fue respondida.';
  END IF;

  IF p_aceptar THEN
    UPDATE entregas_repartidor
    SET estado = 'confirmada', respondido_en = now(), nota_respuesta = NULLIF(TRIM(p_nota), '')
    WHERE id = p_entrega_id;
  ELSE
    -- Restituir inventario: un lote de devolución por producto
    FOR v_item IN
      SELECT producto_id, nombre_producto, cantidad
      FROM entregas_repartidor_items WHERE entrega_id = p_entrega_id
    LOOP
      INSERT INTO lotes_producto (
        negocio_id, producto_id, cantidad, cantidad_actual,
        fecha_recepcion, ubicacion, fecha_caducidad, local_id, notas, activo
      ) VALUES (
        v_entrega.negocio_id, v_item.producto_id, v_item.cantidad, v_item.cantidad,
        CURRENT_DATE, 'ambiente', NULL, v_entrega.local_id,
        'Devolución de entrega a repartidor', true
      );
    END LOOP;

    UPDATE entregas_repartidor
    SET estado = 'rechazada', respondido_en = now(), nota_respuesta = NULLIF(TRIM(p_nota), '')
    WHERE id = p_entrega_id;
  END IF;
END;
$$;

-- ─── Grants (REVOKE global de la migración 049 exige otorgar explícito) ──────

REVOKE EXECUTE ON FUNCTION crear_entrega_repartidor(uuid, uuid, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION crear_entrega_repartidor(uuid, uuid, jsonb, uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION responder_entrega_repartidor(uuid, boolean, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION responder_entrega_repartidor(uuid, boolean, text) TO authenticated, service_role;
