-- =============================================================================
-- 031_multi_plaza_gestion.sql — Gestión de plazas (Fase B)
--
-- Cambios:
--   1. get_miembros_negocio: +local_id, +local_nombre
--   2. asignar_local_empleado(): dueño asigna plaza a empleado
-- =============================================================================

-- ─── 1. get_miembros_negocio: incluye plaza asignada ─────────────────────────

DROP FUNCTION IF EXISTS get_miembros_negocio(uuid);

CREATE FUNCTION get_miembros_negocio(p_negocio_id uuid)
RETURNS TABLE(
  user_id      uuid,
  email        text,
  rol          rol_negocio,
  created_at   timestamptz,
  local_id     uuid,
  local_nombre text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede ver la lista de miembros del negocio.';
  END IF;

  RETURN QUERY
    SELECT un.user_id, u.email::text, un.rol, un.created_at,
           un.local_id, l.nombre AS local_nombre
    FROM public.usuarios_negocio un
    JOIN auth.users u ON u.id = un.user_id
    LEFT JOIN public.locales l ON l.id = un.local_id
    WHERE un.negocio_id = p_negocio_id
    ORDER BY un.rol DESC, un.created_at;
END;
$$;

-- ─── 2. asignar_local_empleado ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION asignar_local_empleado(
  p_negocio_id uuid,
  p_user_id    uuid,
  p_local_id   uuid  -- NULL = sin asignación (acceso a todas las plazas)
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede asignar plazas a empleados.';
  END IF;

  IF p_local_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locales WHERE id = p_local_id AND negocio_id = p_negocio_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'La plaza no existe o no está activa en este negocio.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM usuarios_negocio WHERE negocio_id = p_negocio_id AND user_id = p_user_id AND rol = 'dueno'
  ) THEN
    RAISE EXCEPTION 'No se puede asignar una plaza al dueño.';
  END IF;

  UPDATE usuarios_negocio
  SET local_id = p_local_id
  WHERE negocio_id = p_negocio_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado en el negocio.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION asignar_local_empleado TO authenticated;
