-- =============================================================================
-- MIGRACIÓN 015: Fiados / Cuentas por cobrar
--
-- Reemplaza las "notas pegadas en la pared". Permite fiar una venta completa o
-- productos sueltos dentro de una venta, llevar el registro de abonos y
-- gestionar una lista negra de clientes que no pueden recibir más fiado.
--
-- Deuda de una venta fiada = monto fiado de esa venta − abonos aplicados a ella.
-- Deuda total de un cliente = suma de deudas de sus ventas fiadas.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- clientes: lista negra
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clientes ADD COLUMN en_lista_negra    boolean NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN motivo_lista_negra text;

COMMENT ON COLUMN clientes.en_lista_negra IS
  'Si es true, el cliente no puede recibir más fiado (sí se le puede vender de contado).';
COMMENT ON COLUMN clientes.motivo_lista_negra IS
  'Motivo de la lista negra. Solo el dueño puede modificar estos dos campos (ver trigger proteger_lista_negra_clientes).';

-- Solo el dueño puede cambiar los campos de lista negra, sin importar la
-- policy RLS general de clientes (que sí permite a cualquier miembro editar
-- nombre/teléfono/notas).
CREATE OR REPLACE FUNCTION proteger_lista_negra_clientes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.en_lista_negra IS DISTINCT FROM OLD.en_lista_negra
      OR NEW.motivo_lista_negra IS DISTINCT FROM OLD.motivo_lista_negra)
     AND NOT es_dueno_del_negocio(NEW.negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede gestionar la lista negra.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clientes_proteger_lista_negra
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION proteger_lista_negra_clientes();

-- ─────────────────────────────────────────────────────────────────────────────
-- ventas / venta_items: marca de fiado
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ventas ADD COLUMN es_fiado boolean NOT NULL DEFAULT false;

ALTER TABLE ventas ADD CONSTRAINT ventas_fiado_requiere_cliente
  CHECK (NOT es_fiado OR cliente_id IS NOT NULL);

COMMENT ON COLUMN ventas.es_fiado IS
  'true si al menos un venta_item de esta venta quedó a deber. Una venta fiada siempre tiene cliente_id.';

ALTER TABLE venta_items ADD COLUMN es_fiado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN venta_items.es_fiado IS
  'true si esta línea quedó a deber (fiado parcial dentro de una venta mixta).';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: abonos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE abonos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id     uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  venta_id       uuid        REFERENCES ventas(id) ON DELETE SET NULL,
  monto          integer     NOT NULL CHECK (monto > 0),
  fecha          timestamptz NOT NULL DEFAULT now(),
  notas          text,
  registrado_por uuid        REFERENCES auth.users(id)
);

COMMENT ON TABLE abonos IS
  'Pagos parciales o totales que un cliente hace a su deuda. venta_id NULL = abono general (sobrepago tras saldar todas las notas pendientes).';
COMMENT ON COLUMN abonos.venta_id IS
  'Nota (venta fiada) a la que se aplica este abono. NULL si es un abono general/sobrepago no asociado a una nota específica.';

CREATE INDEX idx_abonos_negocio ON abonos(negocio_id);
CREATE INDEX idx_abonos_cliente ON abonos(cliente_id);
CREATE INDEX idx_abonos_venta   ON abonos(venta_id) WHERE venta_id IS NOT NULL;

ALTER TABLE abonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abonos_ver" ON abonos
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "abonos_insertar" ON abonos
  FOR INSERT WITH CHECK (es_miembro_del_negocio(negocio_id));

-- Sin UPDATE/DELETE: los abonos son un libro de pagos inmutable.

-- ─────────────────────────────────────────────────────────────────────────────
-- registrar_venta: ahora soporta fiar la venta completa o líneas sueltas
-- (mismo nombre/firma de la migración 013 — CREATE OR REPLACE reemplaza la
-- función real, no crea un overload nuevo).
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_venta_id        uuid;
  v_venta_item_id    uuid;
  v_total            integer := 0;
  v_total_fiado      integer := 0;
  v_monto_pagar      integer;
  v_cambio           integer;
  v_corte_id         uuid;
  v_item             jsonb;
  v_prod_id          uuid;
  v_cantidad         integer;
  v_precio           integer;
  v_existencias      integer;
  v_nombre_prod      text;
  v_subtotal         integer;
  v_es_fiado_item    boolean;
  v_restante         integer;
  v_tomar            integer;
  v_lote             RECORD;
  v_en_lista_negra   boolean;
  v_motivo_negra     text;
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

  -- Pasada 1: validar stock y acumular total + total fiado (bloquea el
  -- renglón de producto, lo que también serializa contra cualquier alta/baja
  -- de lote concurrente: el trigger de sync de existencias actualiza este
  -- mismo renglón).
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id       := (v_item->>'producto_id')::uuid;
    v_cantidad      := (v_item->>'cantidad')::integer;
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

    v_total := v_total + (v_precio * v_cantidad);
    IF v_es_fiado_item THEN
      v_total_fiado := v_total_fiado + (v_precio * v_cantidad);
    END IF;
  END LOOP;

  v_total := GREATEST(0, v_total - p_descuento);

  -- Validaciones de fiado: requiere cliente y bloquea clientes en lista negra.
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
      RAISE EXCEPTION 'Este cliente está en lista negra: %', COALESCE(v_motivo_negra, 'sin motivo especificado');
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
    v_total, p_pago_recibido, v_cambio, v_corte_id, 'completada', p_descuento, p_vendedor_id, v_total_fiado > 0
  )
  RETURNING id INTO v_venta_id;

  -- Pasada 2: insertar items y consumir lotes en orden FEFO
  -- (primero en caducar, primero en salir; los sin fecha se consumen al final)
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id       := (v_item->>'producto_id')::uuid;
    v_cantidad      := (v_item->>'cantidad')::integer;
    v_es_fiado_item := COALESCE((v_item->>'es_fiado')::boolean, false);

    SELECT precio_venta INTO v_precio
    FROM   productos
    WHERE  id = v_prod_id;

    v_subtotal := v_precio * v_cantidad;

    INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal, es_fiado)
    VALUES (v_venta_id, v_prod_id, v_cantidad, v_precio, v_subtotal, v_es_fiado_item)
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

COMMENT ON FUNCTION registrar_venta(uuid, jsonb, uuid, uuid, integer, integer, uuid) IS
  'Registra una venta con descuento, vendedor y fiado (total o por línea) opcionales. '
  'Valida stock, cliente y lista negra cuando hay fiado, inserta venta + items con '
  'precio snapshot, y consume lotes en orden FEFO registrando el detalle en venta_lotes. '
  'productos.existencias se actualiza solo mediante el trigger de lotes_producto.';

-- ─────────────────────────────────────────────────────────────────────────────
-- VISTAS: deuda por nota (venta fiada) y por cliente
-- security_invoker = true para que respeten el RLS del usuario que consulta,
-- no el del propietario de la vista.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW fiados_por_venta WITH (security_invoker = true) AS
SELECT
  v.id          AS venta_id,
  v.negocio_id,
  v.cliente_id,
  v.created_at,
  vi.monto_fiado,
  COALESCE(ab.monto_abonado, 0)                       AS monto_abonado,
  vi.monto_fiado - COALESCE(ab.monto_abonado, 0)       AS deuda
FROM ventas v
JOIN LATERAL (
  SELECT COALESCE(SUM(subtotal), 0) AS monto_fiado
  FROM   venta_items
  WHERE  venta_id = v.id AND es_fiado = true
) vi ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(monto), 0) AS monto_abonado
  FROM   abonos
  WHERE  venta_id = v.id
) ab ON true
WHERE v.es_fiado = true AND v.estado = 'completada';

COMMENT ON VIEW fiados_por_venta IS
  'Deuda restante por cada venta fiada (nota). deuda = monto_fiado - monto_abonado, puede ser negativa si se sobrepagó esa nota.';

CREATE VIEW fiados_por_cliente WITH (security_invoker = true) AS
SELECT
  negocio_id,
  cliente_id,
  SUM(deuda)                              AS deuda_total,
  MIN(created_at)                         AS debe_desde,
  COUNT(*) FILTER (WHERE deuda > 0)       AS notas_pendientes
FROM fiados_por_venta
GROUP BY negocio_id, cliente_id
HAVING SUM(deuda) > 0;

COMMENT ON VIEW fiados_por_cliente IS
  'Deuda total por cliente (suma de sus notas). Solo incluye clientes con deuda > 0.';

GRANT SELECT ON fiados_por_venta   TO authenticated;
GRANT SELECT ON fiados_por_cliente TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- registrar_abono: abono dirigido a una nota específica, o general (se
-- distribuye FIFO entre las notas más antiguas con deuda pendiente).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_abono(
  p_negocio_id uuid,
  p_cliente_id uuid,
  p_monto      integer,
  p_venta_id   uuid DEFAULT NULL,
  p_notas      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restante integer := p_monto;
  v_nota     RECORD;
  v_tomar    integer;
BEGIN
  IF NOT es_miembro_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Sin acceso al negocio %.', p_negocio_id;
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del abono debe ser mayor a cero.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM clientes WHERE id = p_cliente_id AND negocio_id = p_negocio_id
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado.';
  END IF;

  IF p_venta_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM ventas
      WHERE id = p_venta_id AND negocio_id = p_negocio_id
        AND cliente_id = p_cliente_id AND es_fiado = true
    ) THEN
      RAISE EXCEPTION 'La nota indicada no corresponde a este cliente.';
    END IF;

    INSERT INTO abonos (negocio_id, cliente_id, venta_id, monto, notas, registrado_por)
    VALUES (p_negocio_id, p_cliente_id, p_venta_id, p_monto, p_notas, auth.uid());
    RETURN;
  END IF;

  -- Abono general: aplicar FIFO a las notas más antiguas con deuda pendiente.
  FOR v_nota IN
    SELECT venta_id, deuda
    FROM   fiados_por_venta
    WHERE  negocio_id = p_negocio_id AND cliente_id = p_cliente_id AND deuda > 0
    ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_restante <= 0;
    v_tomar := LEAST(v_restante, v_nota.deuda);

    INSERT INTO abonos (negocio_id, cliente_id, venta_id, monto, notas, registrado_por)
    VALUES (p_negocio_id, p_cliente_id, v_nota.venta_id, v_tomar, p_notas, auth.uid());

    v_restante := v_restante - v_tomar;
  END LOOP;

  IF v_restante > 0 THEN
    -- Sobrepago: ya no hay notas pendientes que cubrir.
    INSERT INTO abonos (negocio_id, cliente_id, venta_id, monto, notas, registrado_por)
    VALUES (p_negocio_id, p_cliente_id, NULL, v_restante, p_notas, auth.uid());
  END IF;
END;
$$;

COMMENT ON FUNCTION registrar_abono(uuid, uuid, integer, uuid, text) IS
  'Registra un pago a la deuda de un cliente. Si p_venta_id es NULL, distribuye '
  'el monto FIFO entre sus notas más antiguas con deuda pendiente; el remanente '
  'tras saldarlas todas se registra como abono general (venta_id NULL).';

-- ─────────────────────────────────────────────────────────────────────────────
-- cambiar_lista_negra: solo dueño.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cambiar_lista_negra(
  p_cliente_id     uuid,
  p_en_lista_negra boolean,
  p_motivo         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id uuid;
BEGIN
  SELECT negocio_id INTO v_negocio_id FROM clientes WHERE id = p_cliente_id;

  IF v_negocio_id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado.';
  END IF;

  IF NOT es_dueno_del_negocio(v_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede gestionar la lista negra.';
  END IF;

  UPDATE clientes
  SET    en_lista_negra     = p_en_lista_negra,
         motivo_lista_negra = CASE WHEN p_en_lista_negra THEN p_motivo ELSE NULL END
  WHERE  id = p_cliente_id;
END;
$$;

COMMENT ON FUNCTION cambiar_lista_negra(uuid, boolean, text) IS
  'Activa/desactiva la lista negra de un cliente. Solo el dueño del negocio puede llamarla.';
