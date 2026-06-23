-- ── Fase: Eliminar rol administrador ─────────────────────────────────────────
-- El sistema queda con 3 roles: superadmin (tabla separada), dueno, empleado.
-- Los usuarios que tenían rol=administrador pasan a ser empleado.
-- El enum PostgreSQL no permite DROP VALUE; el valor queda en el tipo pero
-- nunca se asignará desde código.

-- 1. Migrar usuarios existentes con rol administrador → empleado
UPDATE usuarios_negocio
SET rol = 'empleado'
WHERE rol = 'administrador';

-- 2. Actualizar es_dueno_o_admin() para que solo valide 'dueno'
CREATE OR REPLACE FUNCTION es_dueno_o_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   usuarios_negocio un
    JOIN   negocios          n  ON n.id = un.negocio_id
    WHERE  un.user_id = auth.uid()
    AND    un.rol     = 'dueno'
    AND    NOT n.suspendido
  );
$$;

COMMENT ON FUNCTION es_dueno_o_admin() IS
  'True si el usuario autenticado es dueño del negocio activo. '
  'Nota: el rol administrador fue eliminado en migración 028.';

-- 3. Actualizar cerrar_corte para que solo el dueño pueda cerrar
CREATE OR REPLACE FUNCTION cerrar_corte(
  p_corte_id       uuid,
  p_monto_contado  integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id uuid;
  v_rol        text;
  v_esperado   integer;
BEGIN
  SELECT negocio_id INTO v_negocio_id
  FROM   cash_register_sessions
  WHERE  id = p_corte_id;

  IF v_negocio_id IS NULL THEN
    RAISE EXCEPTION 'Corte no encontrado.';
  END IF;

  SELECT rol INTO v_rol
  FROM   usuarios_negocio
  WHERE  negocio_id = v_negocio_id AND user_id = auth.uid();

  IF v_rol IS DISTINCT FROM 'dueno' THEN
    RAISE EXCEPTION 'Solo el dueño puede cerrar el corte de caja.';
  END IF;

  SELECT COALESCE(SUM(total), 0) + COALESCE(
    (SELECT monto_apertura FROM cash_register_sessions WHERE id = p_corte_id), 0
  )
  INTO v_esperado
  FROM ventas
  WHERE negocio_id = v_negocio_id
    AND created_at >= (SELECT opened_at FROM cash_register_sessions WHERE id = p_corte_id)
    AND estado = 'completada'
    AND metodo_pago_id IN (
        SELECT id FROM metodos_pago WHERE negocio_id = v_negocio_id AND nombre ILIKE '%efectivo%'
    );

  UPDATE cash_register_sessions
  SET
    closed_at      = now(),
    monto_esperado = v_esperado,
    monto_contado  = p_monto_contado,
    diferencia     = p_monto_contado - v_esperado,
    estado         = 'cerrado'
  WHERE id = p_corte_id;
END;
$$;

COMMENT ON FUNCTION cerrar_corte(uuid, integer) IS
  'SEGURIDAD: requiere rol dueño del negocio.';
