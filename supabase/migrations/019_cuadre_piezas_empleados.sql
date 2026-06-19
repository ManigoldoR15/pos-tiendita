-- Bug 3: Allow pieza adjustments (no lote required)
ALTER TABLE ajustes_inventario ALTER COLUMN lote_id DROP NOT NULL;

-- New function for pieza products (adjust existencias directly)
CREATE OR REPLACE FUNCTION registrar_ajuste_pieza(
  p_negocio_id  uuid,
  p_producto_id uuid,
  p_delta       numeric,
  p_motivo      text,
  p_notas       text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existencias_antes numeric(12,3);
  v_existencias_despues numeric(12,3);
  v_ajuste_id uuid;
BEGIN
  IF NOT es_miembro_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Sin acceso al negocio %.', p_negocio_id;
  END IF;

  IF p_delta = 0 THEN
    RAISE EXCEPTION 'El delta del ajuste no puede ser cero.';
  END IF;

  SELECT existencias INTO v_existencias_antes
  FROM productos
  WHERE id = p_producto_id AND negocio_id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  v_existencias_despues := v_existencias_antes + p_delta;

  IF v_existencias_despues < 0 THEN
    RAISE EXCEPTION 'El ajuste dejaría el producto en cantidad negativa (antes: %, delta: %).', v_existencias_antes, p_delta;
  END IF;

  UPDATE productos
  SET existencias = v_existencias_despues, updated_at = now()
  WHERE id = p_producto_id;

  INSERT INTO ajustes_inventario (
    negocio_id, producto_id, lote_id,
    delta, cantidad_antes, cantidad_despues,
    motivo, notas, registrado_por
  ) VALUES (
    p_negocio_id, p_producto_id, NULL,
    p_delta, v_existencias_antes, v_existencias_despues,
    p_motivo, p_notas, auth.uid()
  )
  RETURNING id INTO v_ajuste_id;

  RETURN v_ajuste_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_ajuste_pieza TO authenticated;
