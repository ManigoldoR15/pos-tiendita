-- =============================================================================
-- 079_suspender_bloquea_login.sql
--
-- PROBLEMA: negocios.suspendido solo lo revisa el layout de (app), que manda a
-- /cuenta-suspendida. El usuario de auth seguía vivo: podía iniciar sesión y su
-- sesión guardada seguía sirviendo. Para bloquear de verdad había que banear a
-- mano en auth.users, y el botón Reactivar del panel no quitaba ese ban, así que
-- el negocio quedaba "reactivado" pero nadie podía entrar.
--
-- SOLUCIÓN: trigger en negocios. Cuando cambia suspendido — venga del botón
-- Suspender/Reactivar, del Guardar de la ficha (actualizar_suscripcion) o de SQL
-- a mano — se aplica lo mismo a los usuarios del negocio:
--   · suspender  → banned_until = 2999-12-31 y se cierran sus sesiones
--   · reactivar  → se quita ese ban
--
-- Un usuario solo queda baneado si TODOS sus negocios están suspendidos, y a los
-- superadmins nunca se les toca. Al reactivar solo se quita el ban con la fecha
-- centinela 2999-12-31: un ban puesto a mano con otra fecha se respeta.
--
-- El trigger de protección (069) corre ANTES y regresa suspendido a su valor
-- original cuando el UPDATE viene de un usuario normal, así que aquí solo llegan
-- cambios hechos por el superadmin o el service role.
-- =============================================================================

CREATE OR REPLACE FUNCTION sincronizar_bloqueo_login_negocio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ban_centinela constant timestamptz := '2999-12-31 00:00:00+00';
BEGIN
  IF NEW.suspendido THEN
    UPDATE auth.users u
       SET banned_until = v_ban_centinela
     WHERE u.id IN (SELECT un.user_id FROM usuarios_negocio un WHERE un.negocio_id = NEW.id)
       AND NOT EXISTS (SELECT 1 FROM superadmins s WHERE s.user_id = u.id)
       AND NOT EXISTS (
         SELECT 1
           FROM usuarios_negocio otro
           JOIN negocios n ON n.id = otro.negocio_id
          WHERE otro.user_id = u.id AND NOT n.suspendido
       );

    -- auth.refresh_tokens.session_id tiene ON DELETE CASCADE, pero user_id es
    -- varchar y hay tokens viejos sin session_id: se borran explícitamente.
    DELETE FROM auth.refresh_tokens rt
     USING auth.users u
     WHERE rt.user_id = u.id::text
       AND u.banned_until = v_ban_centinela
       AND u.id IN (SELECT un.user_id FROM usuarios_negocio un WHERE un.negocio_id = NEW.id);

    DELETE FROM auth.sessions se
     USING auth.users u
     WHERE se.user_id = u.id
       AND u.banned_until = v_ban_centinela
       AND u.id IN (SELECT un.user_id FROM usuarios_negocio un WHERE un.negocio_id = NEW.id);
  ELSE
    UPDATE auth.users u
       SET banned_until = NULL
     WHERE u.id IN (SELECT un.user_id FROM usuarios_negocio un WHERE un.negocio_id = NEW.id)
       AND u.banned_until = v_ban_centinela;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION sincronizar_bloqueo_login_negocio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sincronizar_bloqueo_login_negocio ON negocios;
CREATE TRIGGER trg_sincronizar_bloqueo_login_negocio
  AFTER UPDATE OF suspendido ON negocios
  FOR EACH ROW
  WHEN (OLD.suspendido IS DISTINCT FROM NEW.suspendido)
  EXECUTE FUNCTION sincronizar_bloqueo_login_negocio();
