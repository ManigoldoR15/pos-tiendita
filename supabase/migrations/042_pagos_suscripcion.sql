-- =============================================================================
-- MIGRACIÓN 042: pagos manuales de suscripción (Fase 3 — superadmin)
--
-- Registro manual de cobros de la plataforma (aún sin Stripe):
--   - Tabla pagos_suscripcion: quién pagó, cuándo, cuánto (centavos), qué plan,
--     qué periodo cubre, método y notas.
--   - RPC sa_registrar_pago: inserta el pago y EXTIENDE negocios.suscripcion_fin
--     (desde el vencimiento vigente si aún no vence, o desde la fecha de pago).
--
-- Seguridad: SELECT solo superadmins vía RLS; INSERT/UPDATE/DELETE sin policies
-- (solo el RPC SECURITY DEFINER escribe). No toca la app de los negocios.
--
-- Rollback: supabase/rollback/042_rollback_pagos_suscripcion.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagos_suscripcion (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id     uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  fecha_pago     date        NOT NULL DEFAULT CURRENT_DATE,
  monto          integer     NOT NULL CHECK (monto > 0),          -- centavos MXN
  plan           text        NOT NULL CHECK (plan IN ('mensual', 'anual')),
  periodo_inicio date        NOT NULL,
  periodo_fin    date        NOT NULL,
  metodo         text        NOT NULL DEFAULT 'efectivo'
                             CHECK (metodo IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  notas          text,
  registrado_por uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  CHECK (periodo_fin > periodo_inicio)
);

CREATE INDEX IF NOT EXISTS idx_pagos_susc_negocio ON pagos_suscripcion(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_susc_fecha   ON pagos_suscripcion(fecha_pago);

COMMENT ON TABLE pagos_suscripcion IS
  'Cobros manuales de la suscripción de la plataforma (pre-Stripe). '
  'monto en centavos MXN. Escritura solo vía sa_registrar_pago.';

ALTER TABLE pagos_suscripcion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_susc_ver" ON pagos_suscripcion
  FOR SELECT USING (es_superadmin());
-- Sin policies de escritura: INSERT/UPDATE/DELETE solo vía RPC SECURITY DEFINER.

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: registrar pago y extender vencimiento
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sa_registrar_pago(
  p_negocio_id uuid,
  p_monto      integer,
  p_plan       text,
  p_fecha_pago date DEFAULT CURRENT_DATE,
  p_metodo     text DEFAULT 'efectivo',
  p_notas      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fin_actual     date;
  v_inicio_periodo date;
  v_fin_periodo    date;
  v_pago_id        uuid;
BEGIN
  IF NOT es_superadmin() THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero.';
  END IF;
  IF p_plan NOT IN ('mensual', 'anual') THEN
    RAISE EXCEPTION 'Plan inválido: usa mensual o anual.';
  END IF;

  SELECT suscripcion_fin INTO v_fin_actual
  FROM negocios WHERE id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado.';
  END IF;

  -- Si la suscripción sigue vigente, el nuevo periodo arranca donde termina la
  -- actual (el cliente no pierde días por pagar antes). Si venció o no hay,
  -- arranca en la fecha de pago.
  v_inicio_periodo := GREATEST(COALESCE(v_fin_actual, p_fecha_pago), p_fecha_pago);
  v_fin_periodo := v_inicio_periodo
    + CASE WHEN p_plan = 'mensual' THEN interval '1 month' ELSE interval '1 year' END;

  INSERT INTO pagos_suscripcion (
    negocio_id, fecha_pago, monto, plan, periodo_inicio, periodo_fin,
    metodo, notas, registrado_por
  ) VALUES (
    p_negocio_id, p_fecha_pago, p_monto, p_plan, v_inicio_periodo, v_fin_periodo,
    p_metodo, NULLIF(TRIM(COALESCE(p_notas, '')), ''), auth.uid()
  )
  RETURNING id INTO v_pago_id;

  UPDATE negocios
  SET plan               = p_plan,
      suscripcion_inicio = COALESCE(suscripcion_inicio, p_fecha_pago),
      suscripcion_fin    = v_fin_periodo
  WHERE id = p_negocio_id;

  RETURN jsonb_build_object(
    'pago_id',        v_pago_id,
    'periodo_inicio', v_inicio_periodo,
    'periodo_fin',    v_fin_periodo
  );
END;
$$;

COMMENT ON FUNCTION sa_registrar_pago IS
  'Registra un cobro manual de suscripción y extiende negocios.suscripcion_fin '
  '(+1 mes o +1 año desde el vencimiento vigente o la fecha de pago). Solo superadmins.';
