-- =============================================================================
-- 085_cancelar_movimiento_caja.sql — corregir un movimiento mal capturado
--
-- PROBLEMA (lo dejó la 084). Los movimientos de caja no se pueden editar ni
-- borrar: la tabla solo se escribe por RPC. Eso protege el rastro, pero deja
-- atorado a quien teclea $3,000 en vez de $300 — la caja queda descuadrada por
-- $2,700 y no hay forma de arreglarlo desde la app.
--
-- SOLUCIÓN: cancelar, no borrar. El movimiento se queda en la tabla marcado y
-- tachado en pantalla, y deja de contar en el corte. Borrarlo de verdad
-- reabriría justo el agujero que la 084 cerró: sacar dinero, registrar el
-- retiro, y si conviene, desaparecerlo.
--
-- Solo mientras la caja siga ABIERTA. Un corte cerrado ya tiene su monto
-- esperado, su diferencia y su papel firmado; dejar que cambie después haría
-- que el comprobante impreso deje de coincidir con la base.
-- =============================================================================

ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS cancelado_en  timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES auth.users(id);

COMMENT ON COLUMN movimientos_caja.cancelado_en IS
  'Marcado al corregir un movimiento mal capturado. No se borra la fila a propósito: el rastro es el punto. Un movimiento cancelado no cuenta en cerrar_corte().';

CREATE OR REPLACE FUNCTION public.cancelar_movimiento_caja(p_movimiento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mov    record;
  v_estado text;
BEGIN
  SELECT * INTO v_mov FROM movimientos_caja WHERE id = p_movimiento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento no encontrado.';
  END IF;

  IF NOT es_admin_o_dueno_del_negocio(v_mov.negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede cancelar un movimiento de caja.';
  END IF;

  IF v_mov.cancelado_en IS NOT NULL THEN
    RAISE EXCEPTION 'Ese movimiento ya estaba cancelado.';
  END IF;

  SELECT estado INTO v_estado FROM cortes_caja WHERE id = v_mov.corte_id;
  IF v_estado <> 'abierto' THEN
    RAISE EXCEPTION 'La caja de ese movimiento ya se cerró: su corte ya no se puede cambiar.';
  END IF;

  UPDATE movimientos_caja
  SET    cancelado_en  = now(),
         cancelado_por = auth.uid()
  WHERE  id = p_movimiento_id;
END;
$function$;

-- ── cerrar_corte: los cancelados no cuentan ─────────────────────────────────
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
  v_ingresos     integer := 0;
  v_retiros      integer := 0;
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

    SELECT COALESCE(SUM(total), 0) INTO v_compras_ef
    FROM compras
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;
  END IF;

  SELECT COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0),
         COALESCE(SUM(monto) FILTER (WHERE tipo = 'retiro'),  0)
  INTO   v_ingresos, v_retiros
  FROM   movimientos_caja
  WHERE  corte_id = p_corte_id AND cancelado_en IS NULL;

  v_esperado := v_corte.monto_inicial + v_ventas_ef + v_abonos_ap + v_abonos_fiado
                + v_ingresos - v_gastos_ef - v_compras_ef - v_retiros;
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
    'ingresos_caja',     v_ingresos,
    'retiros_caja',      v_retiros,
    'monto_esperado',    v_esperado,
    'monto_contado',     p_monto_contado,
    'diferencia',        v_diferencia
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION cancelar_movimiento_caja(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cancelar_movimiento_caja(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION cerrar_corte(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cerrar_corte(uuid, integer) TO authenticated, service_role;
