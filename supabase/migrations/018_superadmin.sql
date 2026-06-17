-- ============================================================
-- 018_superadmin.sql  —  Panel de superadmin
-- IMPORTANTE: Sin INSERT ni emails — la cuenta de superadmin
-- se marca solo via SQL directo en la consola, nunca desde la app.
-- ============================================================

-- 1. Tabla superadmins: sin políticas → invisible a usuarios normales
CREATE TABLE IF NOT EXISTS superadmins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;
-- Sin CREATE POLICY aquí. Nadie puede leer ni escribir esta tabla desde el cliente.

-- 2. Helper SECURITY DEFINER — lee la tabla bypaseando RLS
CREATE OR REPLACE FUNCTION es_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM superadmins WHERE user_id = auth.uid()
  )
$$;

-- 3. Campos de suscripción y contacto en negocios
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS email_dueno      text,
  ADD COLUMN IF NOT EXISTS nombre_dueno     text,
  ADD COLUMN IF NOT EXISTS telefono_dueno   text,
  ADD COLUMN IF NOT EXISTS ubicacion        text,
  ADD COLUMN IF NOT EXISTS plan             text NOT NULL DEFAULT 'prueba'
      CHECK (plan IN ('prueba', 'mensual', 'anual')),
  ADD COLUMN IF NOT EXISTS suscripcion_inicio date,
  ADD COLUMN IF NOT EXISTS suscripcion_fin    date,
  ADD COLUMN IF NOT EXISTS suspendido       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas_admin      text;

-- 4. Políticas RLS: superadmin ve y edita TODOS los negocios
CREATE POLICY "superadmin_ver_negocios"
  ON negocios FOR SELECT
  USING (es_superadmin());

CREATE POLICY "superadmin_editar_negocios"
  ON negocios FOR UPDATE
  USING (es_superadmin());

-- 5. Políticas RLS: superadmin ve todos los miembros de todos los negocios
CREATE POLICY "superadmin_ver_usuarios_negocio"
  ON usuarios_negocio FOR SELECT
  USING (es_superadmin());

-- 6. Función: lista de todos los negocios (SECURITY DEFINER — doble protección)
CREATE OR REPLACE FUNCTION get_todos_negocios()
RETURNS TABLE (
  id                uuid,
  nombre            text,
  email_dueno       text,
  nombre_dueno      text,
  telefono_dueno    text,
  ubicacion         text,
  plan              text,
  suscripcion_inicio date,
  suscripcion_fin    date,
  suspendido        boolean,
  notas_admin       text,
  created_at        timestamptz,
  num_miembros      bigint,
  estado_suscripcion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_superadmin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.nombre,
    n.email_dueno,
    n.nombre_dueno,
    n.telefono_dueno,
    n.ubicacion,
    n.plan,
    n.suscripcion_inicio,
    n.suscripcion_fin,
    n.suspendido,
    n.notas_admin,
    n.created_at,
    COUNT(un.user_id)::bigint AS num_miembros,
    CASE
      WHEN n.suspendido THEN 'suspendido'
      WHEN n.plan = 'prueba' THEN 'prueba'
      WHEN n.suscripcion_fin IS NULL THEN 'activo'
      WHEN n.suscripcion_fin >= CURRENT_DATE THEN 'activo'
      ELSE 'vencido'
    END AS estado_suscripcion
  FROM negocios n
  LEFT JOIN usuarios_negocio un ON un.negocio_id = n.id
  GROUP BY n.id
  ORDER BY n.created_at DESC;
END;
$$;

-- 7. Función: actualizar suscripción (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION actualizar_suscripcion(
  p_negocio_id        uuid,
  p_plan              text,
  p_suscripcion_inicio date,
  p_suscripcion_fin    date,
  p_suspendido        boolean,
  p_notas_admin       text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_superadmin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  IF p_plan NOT IN ('prueba', 'mensual', 'anual') THEN
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
