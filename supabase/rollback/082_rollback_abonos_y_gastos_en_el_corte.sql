-- Rollback de 082. Quita los triggers y regresa cerrar_corte y registrar_abono
-- a como estaban (sin abonos de fiado ni gastos en el efectivo esperado).
--
-- Las columnas metodo_pago_id y corte_id NO se tiran: guardan datos reales ya
-- capturados y no estorban a nadie. Si de verdad se quieren quitar, al final
-- está el DROP comentado.

DROP TRIGGER IF EXISTS trg_corte_abono ON abonos;
DROP TRIGGER IF EXISTS trg_corte_gasto ON gastos;
DROP FUNCTION IF EXISTS asignar_corte_abono();
DROP FUNCTION IF EXISTS asignar_corte_gasto();

DROP FUNCTION IF EXISTS public.registrar_abono(uuid, uuid, integer, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.registrar_abono(
  p_negocio_id uuid,
  p_cliente_id uuid,
  p_monto      integer,
  p_venta_id   uuid DEFAULT NULL::uuid,
  p_notas      text DEFAULT NULL::text
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
    INSERT INTO abonos (negocio_id, cliente_id, venta_id, monto, notas, registrado_por)
    VALUES (p_negocio_id, p_cliente_id, NULL, v_restante, p_notas, auth.uid());
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION registrar_abono(uuid,uuid,integer,uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION registrar_abono(uuid,uuid,integer,uuid,text) TO authenticated, service_role;

-- cerrar_corte como lo dejó la 080 (ventas sin fiado + abonos de apartado)
CREATE OR REPLACE FUNCTION public.cerrar_corte(p_corte_id uuid, p_monto_contado integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corte       record;
  v_efectivo_id uuid;
  v_ventas_ef   integer := 0;
  v_abonos_ap   integer := 0;
  v_esperado    integer;
  v_diferencia  integer;
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
      FROM   venta_items WHERE es_fiado GROUP BY venta_id
    ) f ON f.venta_id = v.id
    WHERE  v.corte_id = p_corte_id AND v.metodo_pago_id = v_efectivo_id AND v.estado = 'completada';

    SELECT COALESCE(SUM(monto), 0) INTO v_abonos_ap
    FROM apartado_abonos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;
  END IF;

  v_esperado   := v_corte.monto_inicial + v_ventas_ef + v_abonos_ap;
  v_diferencia := p_monto_contado - v_esperado;

  UPDATE cortes_caja SET
    fecha_cierre = now(), monto_esperado = v_esperado, monto_contado = p_monto_contado,
    diferencia = v_diferencia, estado = 'cerrado', cerrado_por = auth.uid()
  WHERE id = p_corte_id;

  RETURN jsonb_build_object(
    'corte_id', p_corte_id, 'monto_inicial', v_corte.monto_inicial,
    'ventas_efectivo', v_ventas_ef, 'abonos_apartado', v_abonos_ap,
    'monto_esperado', v_esperado, 'monto_contado', p_monto_contado,
    'diferencia', v_diferencia
  );
END;
$function$;

DROP FUNCTION IF EXISTS corte_abierto_de(uuid, uuid);
DROP FUNCTION IF EXISTS local_del_usuario(uuid);

-- Solo si de verdad se quieren perder los datos capturados:
-- ALTER TABLE abonos DROP COLUMN IF EXISTS metodo_pago_id, DROP COLUMN IF EXISTS corte_id;
-- ALTER TABLE gastos DROP COLUMN IF EXISTS metodo_pago_id, DROP COLUMN IF EXISTS corte_id;
