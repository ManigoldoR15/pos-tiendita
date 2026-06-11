-- FUNCIÓN: anular_venta(p_venta_id uuid) → void
-- Cancela una venta completada y restaura el stock de cada producto.
-- Atomicidad: todo en una transacción. Valida membresía al negocio.

CREATE OR REPLACE FUNCTION anular_venta(p_venta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id uuid;
  v_estado     text;
BEGIN
  -- Obtener negocio y estado de la venta
  SELECT negocio_id, estado
  INTO   v_negocio_id, v_estado
  FROM   ventas
  WHERE  id = p_venta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Validar membresía
  IF NOT es_miembro_del_negocio(v_negocio_id) THEN
    RAISE EXCEPTION 'Sin permiso para anular esta venta';
  END IF;

  -- Solo se pueden anular ventas completadas
  IF v_estado <> 'completada' THEN
    RAISE EXCEPTION 'La venta ya fue anulada o no está en estado completada';
  END IF;

  -- Restaurar existencias de cada producto
  UPDATE productos p
  SET    existencias = p.existencias + vi.cantidad
  FROM   venta_items vi
  WHERE  vi.venta_id  = p_venta_id
    AND  vi.producto_id = p.id;

  -- Marcar venta como cancelada
  UPDATE ventas
  SET    estado = 'cancelada'
  WHERE  id = p_venta_id;
END;
$$;

COMMENT ON FUNCTION anular_venta(uuid) IS
  'Cancela una venta completada y restaura el inventario de cada producto vendido. '
  'Valida que el usuario sea miembro del negocio. Solo se puede anular una venta completada.';
