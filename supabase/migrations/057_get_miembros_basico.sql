-- =============================================================================
-- 057_get_miembros_basico.sql — Lista de miembros para cualquier miembro
--
-- get_miembros_negocio es solo-dueño. Para que un empleado pueda elegir a qué
-- repartidor entregarle carga, y para mostrar nombres en /mi-carga (repartidor)
-- y en la lista de entregas, se necesita una lista de miembros (user_id + email
-- + rol) accesible a cualquier miembro del negocio. No expone nada sensible:
-- los correos de compañeros ya son visibles dentro del negocio.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_miembros_basico(p_negocio_id uuid)
RETURNS TABLE (user_id uuid, email text, rol rol_negocio)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT es_miembro_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Sin acceso al negocio.';
  END IF;

  RETURN QUERY
    SELECT un.user_id, u.email::text, un.rol
    FROM   public.usuarios_negocio un
    JOIN   auth.users u ON u.id = un.user_id
    WHERE  un.negocio_id = p_negocio_id
    ORDER BY un.rol DESC, u.email;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_miembros_basico(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_miembros_basico(uuid) TO authenticated, service_role;
