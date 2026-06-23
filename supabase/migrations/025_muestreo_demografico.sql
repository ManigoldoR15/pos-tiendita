-- Periodos de muestreo demográfico por negocio
CREATE TABLE IF NOT EXISTS muestreo_periodos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre       text,
  activo       boolean NOT NULL DEFAULT true,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Solo un periodo activo a la vez por negocio
CREATE UNIQUE INDEX muestreo_un_activo_por_negocio
  ON muestreo_periodos (negocio_id)
  WHERE activo = true;

-- Respuestas individuales por venta (todo nullable = todo opcional)
CREATE TABLE IF NOT EXISTS muestreo_respuestas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  periodo_id   uuid NOT NULL REFERENCES muestreo_periodos(id) ON DELETE CASCADE,
  venta_id     uuid REFERENCES ventas(id) ON DELETE SET NULL,
  sexo         text CHECK (sexo IN ('hombre', 'mujer')),
  rango_edad   text CHECK (rango_edad IN ('nino', 'joven', 'adulto', 'mediana', 'mayor')),
  satisfaccion text CHECK (satisfaccion IN ('buena', 'regular', 'mala')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS muestreo_periodos
ALTER TABLE muestreo_periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY muestreo_periodos_read ON muestreo_periodos
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY muestreo_periodos_write ON muestreo_periodos
  FOR ALL USING (es_admin_o_dueno_del_negocio(negocio_id))
  WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

-- RLS muestreo_respuestas
ALTER TABLE muestreo_respuestas ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro (incluido cajero) puede insertar respuestas
CREATE POLICY muestreo_respuestas_insert ON muestreo_respuestas
  FOR INSERT WITH CHECK (es_miembro_del_negocio(negocio_id));

-- Solo admin/dueño puede leer y borrar respuestas
CREATE POLICY muestreo_respuestas_read ON muestreo_respuestas
  FOR SELECT USING (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY muestreo_respuestas_delete ON muestreo_respuestas
  FOR DELETE USING (es_admin_o_dueno_del_negocio(negocio_id));
