-- =============================================================================
-- 062_fix_actualizar_modulos_auth.sql
--
-- VULNERABILIDAD: actualizar_modulos_negocio era SECURITY DEFINER ejecutable
-- por cualquier usuario autenticado y NO validaba quién llamaba — un cliente
-- podía activarse módulos de paga (p. ej. el rastreador) vía
-- /rest/v1/rpc/actualizar_modulos_negocio, o apagarle módulos a otro negocio.
-- Solo el superadmin (panel /superadmin/negocios/[id]) debe poder llamarla.
-- La función tampoco estaba en migraciones (se creó a mano); queda registrada.
-- =============================================================================

CREATE OR REPLACE FUNCTION actualizar_modulos_negocio(p_negocio_id uuid, p_modulos jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  UPDATE negocios
  SET modulos_habilitados = p_modulos,
      updated_at          = now()
  WHERE id = p_negocio_id;
END;
$$;
