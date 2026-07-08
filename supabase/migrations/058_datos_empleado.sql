-- =============================================================================
-- 058_datos_empleado.sql — Datos generales del empleado (historial de personal)
--
-- El dueño necesita un historial de su personal: quién es cada empleado, su
-- antigüedad (ya la da created_at), quiénes están activos. Se agregan datos
-- generales de identificación de la persona — NO datos fiscales/legales
-- (sin CURP, RFC, NSS, etc.).
--
-- Cambios:
--   1. usuarios_negocio: +nombre_completo, +edad, +sexo (todos nullable)
--   2. get_miembros_negocio: devuelve los nuevos campos
--   3. actualizar_datos_empleado(): el dueño edita/captura los datos
-- =============================================================================

-- ─── 1. Columnas nuevas ──────────────────────────────────────────────────────

ALTER TABLE usuarios_negocio
  ADD COLUMN IF NOT EXISTS nombre_completo text,
  ADD COLUMN IF NOT EXISTS edad            smallint,
  ADD COLUMN IF NOT EXISTS sexo            text;

ALTER TABLE usuarios_negocio
  DROP CONSTRAINT IF EXISTS usuarios_negocio_edad_valida;
ALTER TABLE usuarios_negocio
  ADD CONSTRAINT usuarios_negocio_edad_valida
  CHECK (edad IS NULL OR (edad BETWEEN 14 AND 100));

ALTER TABLE usuarios_negocio
  DROP CONSTRAINT IF EXISTS usuarios_negocio_sexo_valido;
ALTER TABLE usuarios_negocio
  ADD CONSTRAINT usuarios_negocio_sexo_valido
  CHECK (sexo IS NULL OR sexo IN ('hombre', 'mujer', 'otro'));

COMMENT ON COLUMN usuarios_negocio.nombre_completo IS
  'Nombre de la persona (para el historial de personal del dueño). Opcional.';
COMMENT ON COLUMN usuarios_negocio.edad IS
  'Edad de la persona al momento de registrarla. Opcional.';
COMMENT ON COLUMN usuarios_negocio.sexo IS
  'hombre | mujer | otro. Opcional.';

-- Datos personales (PII): la policy usuarios_negocio_ver deja a CUALQUIER
-- miembro leer la tabla. Restringimos estas 3 columnas a nivel de privilegio
-- para que un compañero no pueda leer el nombre/edad/sexo de otro vía PostgREST.
-- Un REVOKE de columna no basta cuando existe el GRANT SELECT a nivel tabla:
-- hay que quitar el SELECT de tabla y re-otorgar solo las columnas no-PII.
-- El dueño lee las PII vía get_miembros_negocio (SECURITY DEFINER, corre como
-- owner → ignora estos grants). Ningún query de la app selecciona estas
-- columnas directamente, así que no rompe nada.
REVOKE SELECT ON usuarios_negocio FROM authenticated, anon;
GRANT  SELECT (negocio_id, user_id, rol, created_at, local_id)
  ON usuarios_negocio TO authenticated, anon;

-- ─── 2. get_miembros_negocio: incluye los datos generales ────────────────────

DROP FUNCTION IF EXISTS get_miembros_negocio(uuid);

CREATE FUNCTION get_miembros_negocio(p_negocio_id uuid)
RETURNS TABLE(
  user_id        uuid,
  email          text,
  rol            rol_negocio,
  created_at     timestamptz,
  local_id       uuid,
  local_nombre   text,
  nombre_completo text,
  edad           smallint,
  sexo           text
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
           un.local_id, l.nombre AS local_nombre,
           un.nombre_completo, un.edad, un.sexo
    FROM public.usuarios_negocio un
    JOIN auth.users u ON u.id = un.user_id
    LEFT JOIN public.locales l ON l.id = un.local_id
    WHERE un.negocio_id = p_negocio_id
    ORDER BY un.rol DESC, un.created_at;
END;
$$;

-- DROP + CREATE resetea los grants al default de Postgres (EXECUTE a PUBLIC).
-- Restauramos el hardening de la migración 049: solo authenticated (valida
-- dueño adentro) y service_role; nunca anon ni PUBLIC.
REVOKE EXECUTE ON FUNCTION get_miembros_negocio(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_miembros_negocio(uuid) TO authenticated, service_role;

-- ─── 3. actualizar_datos_empleado ────────────────────────────────────────────
-- SECURITY DEFINER: no hay policy de UPDATE en usuarios_negocio; el dueño
-- edita los datos a través de esta función (valida rol dueño explícitamente).

CREATE OR REPLACE FUNCTION actualizar_datos_empleado(
  p_negocio_id uuid,
  p_user_id    uuid,
  p_nombre     text,
  p_edad       smallint,
  p_sexo       text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño puede editar los datos del personal.';
  END IF;

  IF p_edad IS NOT NULL AND (p_edad < 14 OR p_edad > 100) THEN
    RAISE EXCEPTION 'La edad no es válida.';
  END IF;

  IF p_sexo IS NOT NULL AND p_sexo NOT IN ('hombre', 'mujer', 'otro') THEN
    RAISE EXCEPTION 'El sexo no es válido.';
  END IF;

  UPDATE usuarios_negocio
  SET nombre_completo = NULLIF(btrim(p_nombre), ''),
      edad            = p_edad,
      sexo            = p_sexo
  WHERE negocio_id = p_negocio_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado en el negocio.';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION actualizar_datos_empleado(uuid, uuid, text, smallint, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION actualizar_datos_empleado(uuid, uuid, text, smallint, text) TO authenticated;
