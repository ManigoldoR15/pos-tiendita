-- =============================================================================
-- 066_abonos_apartado_en_corte.sql
--
-- Los abonos de apartado ahora cuentan en el corte de caja:
--   1. apartado_abonos.corte_id — trigger BEFORE INSERT lo llena con el corte
--      abierto del negocio (asignar_corte_abono_apartado).
--   2. cerrar_corte() suma los abonos EN EFECTIVO del corte al monto esperado
--      y devuelve 'abonos_apartado' en el JSON.
-- Incluye el hardening de grants (regla de la 049): el trigger no es llamable
-- por nadie vía RPC y las RPC de apartados (065) pierden anon/PUBLIC.
-- =============================================================================

ALTER TABLE apartado_abonos
  ADD COLUMN IF NOT EXISTS corte_id uuid REFERENCES cortes_caja(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION asignar_corte_abono_apartado()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.corte_id IS NULL THEN
    SELECT c.id INTO NEW.corte_id
    FROM cortes_caja c
    JOIN apartados a ON a.negocio_id = c.negocio_id
    WHERE a.id = NEW.apartado_id AND c.estado = 'abierto'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corte_abono_apartado ON apartado_abonos;
CREATE TRIGGER trg_corte_abono_apartado
BEFORE INSERT ON apartado_abonos
FOR EACH ROW EXECUTE FUNCTION asignar_corte_abono_apartado();

CREATE OR REPLACE FUNCTION cerrar_corte(
  p_corte_id      uuid,
  p_monto_contado integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    SELECT COALESCE(SUM(total), 0) INTO v_ventas_ef
    FROM ventas
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id AND estado = 'completada';

    SELECT COALESCE(SUM(monto), 0) INTO v_abonos_ap
    FROM apartado_abonos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;
  END IF;

  v_esperado   := v_corte.monto_inicial + v_ventas_ef + v_abonos_ap;
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
    'monto_esperado',    v_esperado,
    'monto_contado',     p_monto_contado,
    'diferencia',        v_diferencia
  );
END;
$$;

-- Hardening de grants (regla 049): las funciones nuevas nacen con EXECUTE a
-- PUBLIC. Aplicado directo en la base el 2026-07-10; se re-declara aquí para
-- que la migración sea reproducible.
REVOKE EXECUTE ON FUNCTION asignar_corte_abono_apartado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cerrar_corte(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cerrar_corte(uuid, integer) TO authenticated, service_role;
-- Regresión de la 065 (funciones creadas sin re-aplicar la 049):
REVOKE EXECUTE ON FUNCTION crear_apartado(uuid,uuid,jsonb,integer,uuid,date,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION abonar_apartado(uuid,integer,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION cancelar_apartado(uuid) FROM PUBLIC, anon;
-- Regresión de la 063 (trigger de variantes con EXECUTE a PUBLIC/anon):
REVOKE EXECUTE ON FUNCTION sync_existencias_variante() FROM PUBLIC, anon, authenticated;
