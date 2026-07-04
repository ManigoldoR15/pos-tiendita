-- =============================================================================
-- 050_mensajes_jefe_y_lecturas.sql — Mensajes dueño→empleado funcionales
--
-- El feature "mensaje a empleados" estaba roto a nivel DB:
--   - 'mensaje_jefe' no estaba en el CHECK de tipo → todo INSERT fallaba
--   - no existía la columna destinatario_id que el código ya enviaba
--   - RLS no permitía al dueño insertarlo ni al empleado leerlo
--
-- Cambios:
--   1. CHECK de tipo incluye 'mensaje_jefe'; +destinatario_id.
--   2. Políticas: dueño/admin inserta mensaje_jefe; el empleado lee los
--      broadcasts (destinatario NULL) y sus mensajes directos.
--   3. notif_lecturas: leído por usuario (un broadcast lo leen varios).
-- =============================================================================

ALTER TABLE notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE notificaciones ADD CONSTRAINT notificaciones_tipo_check CHECK (tipo IN (
  'ajuste_inventario',
  'diferencia_caja',
  'fiado',
  'fiado_lista_negra',
  'mensaje_empleado',
  'mensaje_jefe'
));

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS destinatario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN notificaciones.destinatario_id IS
  'Solo para mensaje_jefe: NULL = para todos los empleados; uuid = mensaje directo.';

-- Dueño/admin puede enviar mensajes a empleados
DROP POLICY IF EXISTS "notif_mensaje_jefe_insert" ON notificaciones;
CREATE POLICY "notif_mensaje_jefe_insert" ON notificaciones
  FOR INSERT
  WITH CHECK (
    tipo = 'mensaje_jefe'
    AND es_admin_o_dueno_del_negocio(negocio_id)
  );

-- Todo miembro ve los mensajes del jefe que le tocan
DROP POLICY IF EXISTS "notif_ver_mensaje_jefe" ON notificaciones;
CREATE POLICY "notif_ver_mensaje_jefe" ON notificaciones
  FOR SELECT
  USING (
    tipo = 'mensaje_jefe'
    AND es_miembro_del_negocio(negocio_id)
    AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
  );

-- Lecturas por usuario (los broadcasts los leen varios empleados)
CREATE TABLE IF NOT EXISTS notif_lecturas (
  notificacion_id uuid NOT NULL REFERENCES notificaciones(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leida_en        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacion_id, user_id)
);

ALTER TABLE notif_lecturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecturas_propias_select" ON notif_lecturas;
CREATE POLICY "lecturas_propias_select" ON notif_lecturas
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lecturas_propias_insert" ON notif_lecturas;
CREATE POLICY "lecturas_propias_insert" ON notif_lecturas
  FOR INSERT WITH CHECK (user_id = auth.uid());
