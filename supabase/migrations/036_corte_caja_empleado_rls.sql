-- Empleados necesitan poder abrir y cerrar su propia caja
DROP POLICY IF EXISTS "corte_abrir"      ON cortes_caja;
DROP POLICY IF EXISTS "corte_actualizar" ON cortes_caja;

-- Cualquier miembro del negocio puede abrir caja
CREATE POLICY "corte_abrir" ON cortes_caja FOR INSERT
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- Dueño/admin puede actualizar cualquier corte;
-- empleado solo puede actualizar el suyo propio (para cerrar su caja)
CREATE POLICY "corte_actualizar" ON cortes_caja FOR UPDATE
  USING (
    es_admin_o_dueno_del_negocio(negocio_id)
    OR (es_miembro_del_negocio(negocio_id) AND abierto_por = auth.uid())
  );
