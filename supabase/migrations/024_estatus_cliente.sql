-- Semáforo de estatus del cliente: verde / amarillo / rojo
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS estatus             text CHECK (estatus IN ('verde', 'amarillo', 'rojo')),
  ADD COLUMN IF NOT EXISTS estatus_nota        text,
  ADD COLUMN IF NOT EXISTS estatus_updated_at  timestamptz;

-- Función SECURITY DEFINER: solo admin/dueño puede cambiar el estatus
CREATE OR REPLACE FUNCTION set_estatus_cliente(
  p_cliente_id uuid,
  p_estatus    text    DEFAULT NULL,
  p_nota       text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio_id uuid;
BEGIN
  SELECT negocio_id INTO v_negocio_id
    FROM clientes
   WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  IF NOT es_admin_o_dueno_del_negocio(v_negocio_id) THEN
    RAISE EXCEPTION 'Sin permiso para cambiar estatus del cliente';
  END IF;

  IF p_estatus IS NOT NULL AND p_estatus NOT IN ('verde', 'amarillo', 'rojo') THEN
    RAISE EXCEPTION 'Estatus inválido: %', p_estatus;
  END IF;

  UPDATE clientes
     SET estatus             = p_estatus,
         estatus_nota        = p_nota,
         estatus_updated_at  = CASE
                                 WHEN p_estatus IS DISTINCT FROM estatus THEN now()
                                 ELSE estatus_updated_at
                               END,
         updated_at          = now()
   WHERE id = p_cliente_id;
END;
$$;
