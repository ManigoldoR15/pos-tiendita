-- Rollback de 085: se quita la posibilidad de corregir un movimiento mal
-- capturado, y cerrar_corte vuelve a contar TODOS los movimientos (incluidos
-- los que se hayan cancelado antes del rollback — revisar movimientos_caja
-- WHERE cancelado_en IS NOT NULL antes de aplicarlo).
-- Las columnas cancelado_en/cancelado_por no se tiran: guardan el rastro.

DROP FUNCTION IF EXISTS public.cancelar_movimiento_caja(uuid);

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
  WHERE  corte_id = p_corte_id;

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


REVOKE EXECUTE ON FUNCTION cerrar_corte(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cerrar_corte(uuid, integer) TO authenticated, service_role;

-- Solo si se quiere perder el rastro de las correcciones:
-- ALTER TABLE movimientos_caja DROP COLUMN IF EXISTS cancelado_en, DROP COLUMN IF EXISTS cancelado_por;
