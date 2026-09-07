-- =============================================================================
-- 078_fix_plan_compra_en_actualizar_suscripcion.sql
--
-- BUG: la migración 061 agregó el plan 'compra' (compra única) al CHECK de
-- negocios.plan y al selector del panel, pero NO a actualizar_suscripcion(),
-- que siguió aceptando solo ('prueba','mensual','anual'). Resultado: guardar
-- la ficha de un negocio con plan "Compra única" truena con
-- "Plan inválido: compra" y el botón Guardar no sirve — ni siquiera para
-- corregir la dirección o el teléfono, que van en el mismo formulario.
-- =============================================================================

CREATE OR REPLACE FUNCTION actualizar_suscripcion(
  p_negocio_id         uuid,
  p_plan               text,
  p_suscripcion_inicio date,
  p_suscripcion_fin    date,
  p_suspendido         boolean,
  p_notas_admin        text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_superadmin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  -- Mismos valores que el CHECK de negocios.plan (migración 061)
  IF p_plan NOT IN ('prueba', 'mensual', 'anual', 'compra') THEN
    RAISE EXCEPTION 'Plan inválido: %', p_plan;
  END IF;

  UPDATE negocios SET
    plan               = p_plan,
    suscripcion_inicio = p_suscripcion_inicio,
    suscripcion_fin    = p_suscripcion_fin,
    suspendido         = p_suspendido,
    notas_admin        = COALESCE(p_notas_admin, notas_admin),
    updated_at         = now()
  WHERE id = p_negocio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id;
  END IF;
END;
$$;
