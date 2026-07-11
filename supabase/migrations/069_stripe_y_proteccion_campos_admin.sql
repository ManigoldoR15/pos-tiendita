-- =============================================================================
-- 069_stripe_y_proteccion_campos_admin.sql
--
-- (A) Columnas para la suscripción Stripe en negocios.
-- (B) FIX DE SEGURIDAD CRÍTICO: la policy negocios_editar (owner_id=auth.uid())
--     dejaba al dueño editar CUALQUIER columna de su fila vía PostgREST,
--     incluidas las administrativas: podía activarse módulos de paga y ponerse
--     plan='mensual'/suscripcion_fin lejano => suscripción infinita gratis.
--     (Verificado con curl como dueño antes del fix: el UPDATE pasaba.)
--     Un trigger congela esos campos cuando quien actualiza es 'authenticated'
--     (dueño vía PostgREST). Los caminos legítimos pasan intactos:
--       - superadmin por RPC SECURITY DEFINER  → current_user = postgres
--       - superadmin/webhook por service client → current_user = service_role
--     El dueño conserva la edición de su perfil (nombre, rfc, ciudad, etc.).
--     Verificado tras el fix: ataques de módulos/plan bloqueados, edición de
--     nombre sigue funcionando.
-- =============================================================================

-- (A) Stripe -----------------------------------------------------------------
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_status          text;  -- trialing|active|past_due|canceled|unpaid|NULL

CREATE INDEX IF NOT EXISTS negocios_stripe_customer_idx
  ON negocios (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN negocios.stripe_status IS
  'Estado crudo de la suscripción en Stripe. NULL = nunca usó Stripe (flujo manual del superadmin).';

-- (B) Protección de campos administrativos -----------------------------------
CREATE OR REPLACE FUNCTION proteger_campos_admin_negocio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- current_user = 'authenticated' solo cuando el UPDATE llega directo por
  -- PostgREST con token de usuario. Dentro de una función SECURITY DEFINER de
  -- postgres es 'postgres'; con el service key es 'service_role'. Ambos pasan.
  IF current_user = 'authenticated' THEN
    NEW.owner_id                   := OLD.owner_id;
    NEW.plan                       := OLD.plan;
    NEW.suscripcion_inicio         := OLD.suscripcion_inicio;
    NEW.suscripcion_fin            := OLD.suscripcion_fin;
    NEW.suspendido                 := OLD.suspendido;
    NEW.es_demo                    := OLD.es_demo;
    NEW.notas_admin                := OLD.notas_admin;
    NEW.sospecha_cuenta_compartida := OLD.sospecha_cuenta_compartida;
    NEW.modulos_habilitados        := OLD.modulos_habilitados;
    NEW.max_plazas                 := OLD.max_plazas;
    NEW.max_empleados              := OLD.max_empleados;
    NEW.max_cajas                  := OLD.max_cajas;
    NEW.stripe_customer_id         := OLD.stripe_customer_id;
    NEW.stripe_subscription_id     := OLD.stripe_subscription_id;
    NEW.stripe_status              := OLD.stripe_status;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION proteger_campos_admin_negocio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_proteger_campos_admin_negocio ON negocios;
CREATE TRIGGER trg_proteger_campos_admin_negocio
  BEFORE UPDATE ON negocios
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_admin_negocio();
