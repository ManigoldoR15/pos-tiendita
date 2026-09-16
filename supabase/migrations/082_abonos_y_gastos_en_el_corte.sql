-- =============================================================================
-- 082_abonos_y_gastos_en_el_corte.sql — el cajón por fin cuadra
--
-- PROBLEMA (hermano del que arregló la 080). El efectivo esperado del corte solo
-- miraba ventas y abonos de apartado. Dos movimientos de dinero real quedaban
-- fuera:
--   · Un cliente paga su fiado en efectivo → el billete entra al cajón y el
--     corte no lo cuenta → marca SOBRANTE.
--   · El dueño le paga al proveedor sacando del cajón → el billete sale y el
--     corte no lo descuenta → marca FALTANTE.
-- En una tienda que fía y paga mercancía a diario el corte nunca cuadra, y el
-- mostrador lo lee como robo.
--
-- Ni abonos ni gastos guardaban con qué se pagó ni a qué caja pertenecían, así
-- que no era cuestión de sumar: faltaban las columnas.
--
-- SOLUCIÓN:
--   1. abonos y gastos ganan metodo_pago_id y corte_id.
--   2. Triggers BEFORE INSERT que enganchan el movimiento a la caja abierta,
--      eligiendo la de su plaza igual que registrar_venta.
--   3. registrar_abono acepta el método de pago y lo propaga a todas las filas
--      que genera (un abono general se reparte en varias por FIFO).
--   4. cerrar_corte suma los abonos de fiado en efectivo y RESTA los gastos en
--      efectivo.
--
-- Nota sobre es_personal: si el dueño saca del cajón para un gasto personal, el
-- billete igual salió. El corte cuenta dinero, no utilidad, así que también se
-- descuenta. La separación negocio/personal sigue viva en el dashboard.
-- =============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- La caja abierta que le toca a un movimiento. Mismo criterio que
-- registrar_venta: gana la de su plaza (NULL = NULL cuenta) y, si no hay, la
-- última abierta. Con una sola caja abierta siempre devuelve esa.
CREATE OR REPLACE FUNCTION corte_abierto_de(p_negocio_id uuid, p_local_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id
  FROM   cortes_caja
  WHERE  negocio_id = p_negocio_id AND estado = 'abierto'
  ORDER BY (local_id IS NOT DISTINCT FROM p_local_id) DESC, fecha_apertura DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION local_del_usuario(p_negocio_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT local_id
  FROM   usuarios_negocio
  WHERE  negocio_id = p_negocio_id AND user_id = auth.uid()
  LIMIT  1
$$;

-- ── Columnas nuevas ─────────────────────────────────────────────────────────

ALTER TABLE abonos
  ADD COLUMN IF NOT EXISTS metodo_pago_id uuid REFERENCES metodos_pago(id),
  ADD COLUMN IF NOT EXISTS corte_id       uuid REFERENCES cortes_caja(id) ON DELETE SET NULL;

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS metodo_pago_id uuid REFERENCES metodos_pago(id),
  ADD COLUMN IF NOT EXISTS corte_id       uuid REFERENCES cortes_caja(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_abonos_corte ON abonos(corte_id);
CREATE INDEX IF NOT EXISTS idx_gastos_corte ON gastos(corte_id);

-- ── Enganche automático a la caja abierta ───────────────────────────────────

-- El corte y el método SIEMPRE se recalculan aquí, nunca se respeta lo que
-- venga en el INSERT: /gastos escribe directo en la tabla desde el cliente, y
-- sin esto un miembro del negocio podría colgar el movimiento de la caja que
-- quisiera o apuntar a un método de pago ajeno.
CREATE OR REPLACE FUNCTION asignar_corte_abono()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT id INTO NEW.metodo_pago_id
  FROM   metodos_pago
  WHERE  id = NEW.metodo_pago_id AND negocio_id = NEW.negocio_id AND activo = true;

  NEW.corte_id := corte_abierto_de(NEW.negocio_id, local_del_usuario(NEW.negocio_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corte_abono ON abonos;
CREATE TRIGGER trg_corte_abono
BEFORE INSERT ON abonos
FOR EACH ROW EXECUTE FUNCTION asignar_corte_abono();

-- Solo los gastos del día se enganchan. Capturar hoy un gasto con fecha de la
-- semana pasada no debe desacomodar la caja de hoy.
CREATE OR REPLACE FUNCTION asignar_corte_gasto()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT id INTO NEW.metodo_pago_id
  FROM   metodos_pago
  WHERE  id = NEW.metodo_pago_id AND negocio_id = NEW.negocio_id AND activo = true;

  IF NEW.fecha = (now() AT TIME ZONE 'America/Mexico_City')::date THEN
    NEW.corte_id := corte_abierto_de(
      NEW.negocio_id,
      COALESCE(NEW.local_id, local_del_usuario(NEW.negocio_id))
    );
  ELSE
    NEW.corte_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corte_gasto ON gastos;
CREATE TRIGGER trg_corte_gasto
BEFORE INSERT ON gastos
FOR EACH ROW EXECUTE FUNCTION asignar_corte_gasto();

-- ── registrar_abono: ahora sabe con qué le pagaron ──────────────────────────
-- Agregar parámetro cambia la firma: hay que tirar la vieja o PostgREST se
-- queda con dos sobrecargas ambiguas.

DROP FUNCTION IF EXISTS public.registrar_abono(uuid, uuid, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.registrar_abono(
  p_negocio_id     uuid,
  p_cliente_id     uuid,
  p_monto          integer,
  p_venta_id       uuid DEFAULT NULL::uuid,
  p_notas          text DEFAULT NULL::text,
  p_metodo_pago_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_restante integer := p_monto;
  v_nota     RECORD;
  v_tomar    integer;
  v_metodo   uuid;
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

  -- El método tiene que ser de este negocio y estar activo; si no, se guarda
  -- sin método (no cuenta en la caja) en vez de apuntar a uno ajeno.
  SELECT id INTO v_metodo
  FROM   metodos_pago
  WHERE  id = p_metodo_pago_id AND negocio_id = p_negocio_id AND activo = true;

  IF p_venta_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM ventas
      WHERE id = p_venta_id AND negocio_id = p_negocio_id
        AND cliente_id = p_cliente_id AND es_fiado = true
    ) THEN
      RAISE EXCEPTION 'La nota indicada no corresponde a este cliente.';
    END IF;

    INSERT INTO abonos (negocio_id, cliente_id, venta_id, monto, notas, registrado_por, metodo_pago_id)
    VALUES (p_negocio_id, p_cliente_id, p_venta_id, p_monto, p_notas, auth.uid(), v_metodo);
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

    INSERT INTO abonos (negocio_id, cliente_id, venta_id, monto, notas, registrado_por, metodo_pago_id)
    VALUES (p_negocio_id, p_cliente_id, v_nota.venta_id, v_tomar, p_notas, auth.uid(), v_metodo);

    v_restante := v_restante - v_tomar;
  END LOOP;

  IF v_restante > 0 THEN
    -- Sobrepago: ya no hay notas pendientes que cubrir.
    INSERT INTO abonos (negocio_id, cliente_id, venta_id, monto, notas, registrado_por, metodo_pago_id)
    VALUES (p_negocio_id, p_cliente_id, NULL, v_restante, p_notas, auth.uid(), v_metodo);
  END IF;
END;
$function$;

-- ── cerrar_corte: la cuenta completa del cajón ──────────────────────────────

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

    -- Lo que entró al cajón cuando un cliente vino a pagar su fiado.
    SELECT COALESCE(SUM(monto), 0) INTO v_abonos_fiado
    FROM abonos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;

    -- Lo que salió del cajón para pagar gastos.
    SELECT COALESCE(SUM(monto), 0) INTO v_gastos_ef
    FROM gastos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;
  END IF;

  v_esperado   := v_corte.monto_inicial + v_ventas_ef + v_abonos_ap + v_abonos_fiado - v_gastos_ef;
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
    'monto_esperado',    v_esperado,
    'monto_contado',     p_monto_contado,
    'diferencia',        v_diferencia
  );
END;
$function$;

-- ── Hardening de grants (regla 049) ─────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION corte_abierto_de(uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION local_del_usuario(uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION asignar_corte_abono()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION asignar_corte_gasto()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION registrar_abono(uuid,uuid,integer,uuid,text,uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION registrar_abono(uuid,uuid,integer,uuid,text,uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION cerrar_corte(uuid, integer)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cerrar_corte(uuid, integer)    TO authenticated, service_role;
