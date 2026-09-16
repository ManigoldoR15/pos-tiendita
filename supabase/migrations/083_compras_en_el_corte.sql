-- =============================================================================
-- 083_compras_en_el_corte.sql — pagar mercancía del cajón ya se descuenta
--
-- PROBLEMA: la 082 metió los gastos al corte, pero las compras entran por otra
-- puerta. Si el dueño le paga al proveedor desde /compras en vez de capturarlo
-- como gasto, ese billete sale del cajón y el corte no se entera → marca
-- SOBRANTE. Es el mismo bug, por la puerta de al lado.
--
-- SOLUCIÓN: compras gana metodo_pago_id y corte_id, con el mismo trigger que
-- gastos, y cerrar_corte resta las compras pagadas en efectivo.
--
-- OJO con el doble conteo: una compra NO genera un gasto (registrar_compra no
-- toca la tabla gastos), y es correcto que así sea — la mercancía es inventario,
-- y su costo llega a las ganancias vía precio_costo cuando se vende, no como
-- gasto del día. Por eso una compra capturada aquí no debe capturarse otra vez
-- en Gastos: contaría doble en la caja y doble en las ganancias.
-- =============================================================================

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS metodo_pago_id uuid REFERENCES metodos_pago(id),
  ADD COLUMN IF NOT EXISTS corte_id       uuid REFERENCES cortes_caja(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_compras_corte ON compras(corte_id);

-- Mismo criterio que la 082: el trigger SIEMPRE recalcula, nunca respeta lo que
-- venga en el INSERT. La política compras_gestionar deja a un dueño escribir
-- directo en la tabla, así que el RPC no es la única puerta.
CREATE OR REPLACE FUNCTION asignar_corte_compra()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT id INTO NEW.metodo_pago_id
  FROM   metodos_pago
  WHERE  id = NEW.metodo_pago_id AND negocio_id = NEW.negocio_id AND activo = true;

  IF NEW.fecha = (now() AT TIME ZONE 'America/Mexico_City')::date THEN
    NEW.corte_id := corte_abierto_de(NEW.negocio_id, local_del_usuario(NEW.negocio_id));
  ELSE
    NEW.corte_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corte_compra ON compras;
CREATE TRIGGER trg_corte_compra
BEFORE INSERT ON compras
FOR EACH ROW EXECUTE FUNCTION asignar_corte_compra();

-- ── registrar_compra: ahora pregunta con qué se pagó ────────────────────────
DROP FUNCTION IF EXISTS public.registrar_compra(uuid, uuid, date, text, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.registrar_compra(
  p_negocio_id     uuid,
  p_proveedor_id   uuid,
  p_fecha          date,
  p_notas          text,
  p_items          jsonb,
  p_local_id       uuid DEFAULT NULL::uuid,
  p_metodo_pago_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cantidad   := (v_item->>'cantidad')::numeric;
    v_costo_unit := (v_item->>'costo_unitario')::integer;
    v_total      := v_total + ROUND(v_cantidad * v_costo_unit)::integer;
  END LOOP;

  -- El trigger valida el método y engancha la caja.
  INSERT INTO compras (negocio_id, proveedor_id, fecha, total, notas, registrado_por, metodo_pago_id)
  VALUES (p_negocio_id, p_proveedor_id, p_fecha, v_total,
          NULLIF(TRIM(COALESCE(p_notas, '')), ''), auth.uid(), p_metodo_pago_id)
  RETURNING id INTO v_compra_id;

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
$function$;

-- ── cerrar_corte: ahora también resta las compras pagadas en efectivo ───────
CREATE OR REPLACE FUNCTION public.cerrar_corte(p_corte_id uuid, p_monto_contado integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corte        record;
  v_efectivo_id  uuid;
  v_ventas_ef    integer := 0;
  v_abonos_ap    integer := 0;
  v_abonos_fiado integer := 0;
  v_gastos_ef    integer := 0;
  v_compras_ef   integer := 0;
  v_esperado     integer;
  v_diferencia   integer;
BEGIN
  IF p_monto_contado < 0 THEN
    RAISE EXCEPTION 'El monto contado no puede ser negativo.';
  END IF;

  SELECT * INTO v_corte FROM cortes_caja WHERE id = p_corte_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corte de caja no encontrado: %.', p_corte_id;
  END IF;
  IF NOT es_admin_o_dueno_del_negocio(v_corte.negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede cerrar el corte de caja.';
  END IF;
  IF v_corte.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El corte % ya está cerrado.', p_corte_id;
  END IF;

  SELECT id INTO v_efectivo_id
  FROM metodos_pago
  WHERE negocio_id = v_corte.negocio_id AND lower(nombre) = 'efectivo' AND activo = true
  LIMIT 1;

  IF v_efectivo_id IS NOT NULL THEN
    -- Solo la parte de contado. GREATEST(0, ...) replica registrar_venta, donde
    -- el descuento ya viene restado de total pero no de los subtotales fiados.
    SELECT COALESCE(SUM(GREATEST(0, v.total - COALESCE(f.fiado, 0))), 0)
    INTO   v_ventas_ef
    FROM   ventas v
    LEFT JOIN (
      SELECT venta_id, SUM(subtotal) AS fiado
      FROM   venta_items
      WHERE  es_fiado
      GROUP  BY venta_id
    ) f ON f.venta_id = v.id
    WHERE  v.corte_id       = p_corte_id
      AND  v.metodo_pago_id = v_efectivo_id
      AND  v.estado         = 'completada';

    SELECT COALESCE(SUM(monto), 0) INTO v_abonos_ap
    FROM apartado_abonos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_abonos_fiado
    FROM abonos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_gastos_ef
    FROM gastos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;

    -- Mercancía pagada del cajón.
    SELECT COALESCE(SUM(total), 0) INTO v_compras_ef
    FROM compras
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;
  END IF;

  v_esperado := v_corte.monto_inicial + v_ventas_ef + v_abonos_ap + v_abonos_fiado
                - v_gastos_ef - v_compras_ef;
  v_diferencia := p_monto_contado - v_esperado;

  UPDATE cortes_caja SET
    fecha_cierre   = now(),
    monto_esperado = v_esperado,
    monto_contado  = p_monto_contado,
    diferencia     = v_diferencia,
    estado         = 'cerrado',
    cerrado_por    = auth.uid()
  WHERE id = p_corte_id;

  RETURN jsonb_build_object(
    'corte_id',          p_corte_id,
    'monto_inicial',     v_corte.monto_inicial,
    'ventas_efectivo',   v_ventas_ef,
    'abonos_apartado',   v_abonos_ap,
    'abonos_fiado',      v_abonos_fiado,
    'gastos_efectivo',   v_gastos_ef,
    'compras_efectivo',  v_compras_ef,
    'monto_esperado',    v_esperado,
    'monto_contado',     p_monto_contado,
    'diferencia',        v_diferencia
  );
END;
$function$;

-- ── Hardening de grants (regla 049) ─────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION asignar_corte_compra() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION registrar_compra(uuid,uuid,date,text,jsonb,uuid,uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION registrar_compra(uuid,uuid,date,text,jsonb,uuid,uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION cerrar_corte(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cerrar_corte(uuid, integer) TO authenticated, service_role;
