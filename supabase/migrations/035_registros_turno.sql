-- Tabla de asistencia / registro de turno de empleados
CREATE TABLE registros_turno (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,  -- email-prefix del empleado (denorm para display rápido)
  entrada_at  timestamptz NOT NULL DEFAULT now(),
  salida_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE registros_turno ENABLE ROW LEVEL SECURITY;

-- Empleado ve sus propios registros; dueño ve todos los de su negocio
CREATE POLICY "ver_turno" ON registros_turno FOR SELECT
  USING (
    user_id = auth.uid()
    OR negocio_id IN (
      SELECT negocio_id FROM usuarios_negocio
      WHERE user_id = auth.uid() AND rol = 'dueno'
    )
  );

-- Empleado puede insertar su propia entrada en su negocio
CREATE POLICY "insertar_turno" ON registros_turno FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND negocio_id IN (
      SELECT negocio_id FROM usuarios_negocio WHERE user_id = auth.uid()
    )
  );

-- Empleado puede actualizar su propio registro (para registrar salida)
CREATE POLICY "actualizar_turno" ON registros_turno FOR UPDATE
  USING (user_id = auth.uid());

-- Índices útiles
CREATE INDEX registros_turno_negocio_fecha
  ON registros_turno (negocio_id, entrada_at DESC);

CREATE INDEX registros_turno_user_fecha
  ON registros_turno (user_id, entrada_at DESC);
