-- =============================================================================
-- 059_fix_eliminar_negocio_orden.sql
--
-- sa_eliminar_negocio fallaba con negocios que tienen ventas o entregas:
-- venta_items.producto_id y entregas_repartidor_items.producto_id son FK
-- NO ACTION hacia productos, y Postgres las valida durante el cascade de
-- negocios→productos ANTES de procesar el cascade negocios→ventas→venta_items.
-- Se pre-borran esos dependientes explícitamente, igual que ya se hacía con
-- ajustes_inventario, compras_items, lista_precio_items y merma_referencia.
-- =============================================================================

CREATE OR REPLACE FUNCTION sa_eliminar_negocio(p_negocio_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids  uuid[];
  v_huerfanos uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM negocios WHERE id = p_negocio_id) THEN
    RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT un.user_id), '{}')
  INTO v_user_ids
  FROM usuarios_negocio un
  WHERE un.negocio_id = p_negocio_id;

  -- Dependientes con FK NO ACTION hacia productos: borrar antes del cascade
  DELETE FROM venta_items vi USING ventas v
    WHERE vi.venta_id = v.id AND v.negocio_id = p_negocio_id;
  DELETE FROM entregas_repartidor_items ei USING entregas_repartidor e
    WHERE ei.entrega_id = e.id AND e.negocio_id = p_negocio_id;

  -- Tablas con FK NO ACTION hacia negocios: limpiar manualmente antes
  DELETE FROM ajustes_inventario  WHERE negocio_id = p_negocio_id;
  DELETE FROM compras_items       WHERE negocio_id = p_negocio_id;
  DELETE FROM lista_precio_items  WHERE negocio_id = p_negocio_id;
  DELETE FROM merma_referencia    WHERE negocio_id = p_negocio_id;

  -- El resto de tablas cascadean (bitacora_accesos hace SET NULL y conserva historial)
  DELETE FROM negocios WHERE id = p_negocio_id;

  -- Usuarios que ya no pertenecen a ningún negocio y no son superadmins
  SELECT COALESCE(array_agg(u), '{}')
  INTO v_huerfanos
  FROM unnest(v_user_ids) AS u
  WHERE NOT EXISTS (SELECT 1 FROM usuarios_negocio un2 WHERE un2.user_id = u)
    AND NOT EXISTS (SELECT 1 FROM superadmins s WHERE s.user_id = u);

  RETURN v_huerfanos;
END;
$$;
