-- =============================================================================
-- MIGRACIÓN 011: Módulo de caducidad con semáforo
--
-- Tablas nuevas:
--   - categorias_perecedero : plantilla de vida útil por categoría (por negocio)
--   - lotes_producto         : registro de lotes con fecha de caducidad
--
-- Cambio en productos:
--   - tipo_caducidad : 'envasado' | 'fresco' | NULL (sin seguimiento)
--
-- Semáforo calculado en app (no en DB) para flexibilidad:
--   verde → >20% vida útil restante y >3 días
--   amarillo → ≤20% vida útil o ≤3 días pero no vencido
--   rojo → vencido 0-7 días atrás (solo envasados; frescos van directo a negro)
--   negro → vencido >7 días, fresco vencido, o marcado manualmente
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columna tipo_caducidad en productos
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tipo_caducidad text
  CHECK (tipo_caducidad IN ('envasado', 'fresco'));

COMMENT ON COLUMN productos.tipo_caducidad IS
  'NULL = sin seguimiento de caducidad. '
  'envasado = fecha impresa en empaque. '
  'fresco = se calcula desde recepción + días por ubicación.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabla categorias_perecedero (plantilla editable por negocio)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categorias_perecedero (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id    uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre        text        NOT NULL,
  dias_refri    integer     CHECK (dias_refri > 0),
  dias_congelador integer   CHECK (dias_congelador > 0),
  dias_ambiente integer     CHECK (dias_ambiente > 0),
  orden         integer     NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cat_perecedero_negocio ON categorias_perecedero(negocio_id);

COMMENT ON TABLE categorias_perecedero IS
  'Plantilla de vida útil por categoría de perecedero. '
  'Editable por el dueño. Sembrada con valores FDA/FAO/AESAN al primer uso.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabla lotes_producto (registro de entradas de mercancía)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lotes_producto (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id       uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto_id      uuid        NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad         integer     NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  fecha_recepcion  date        NOT NULL DEFAULT CURRENT_DATE,
  ubicacion        text        NOT NULL DEFAULT 'ambiente'
                               CHECK (ubicacion IN ('refri', 'congelador', 'ambiente')),
  fecha_caducidad  date        NOT NULL,
  estado_manual    text        CHECK (estado_manual IS NULL OR estado_manual = 'negro'),
  notas            text,
  activo           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lotes_negocio    ON lotes_producto(negocio_id);
CREATE INDEX IF NOT EXISTS idx_lotes_producto   ON lotes_producto(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_caducidad  ON lotes_producto(fecha_caducidad) WHERE activo = true;

COMMENT ON TABLE lotes_producto IS
  'Cada fila es un lote de mercancía con su fecha de caducidad. '
  'El semáforo (verde/amarillo/rojo/negro) se calcula en la app según fecha_caducidad. '
  'estado_manual = ''negro'' permite marcado manual sin importar la fecha.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — usa los helpers ya existentes de migración 010
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE categorias_perecedero ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_producto        ENABLE ROW LEVEL SECURITY;

-- categorias_perecedero: ver = todos los miembros; modificar = admin/dueño
CREATE POLICY "cat_pereced_ver"
  ON categorias_perecedero FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "cat_pereced_insertar"
  ON categorias_perecedero FOR INSERT
  WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "cat_pereced_actualizar"
  ON categorias_perecedero FOR UPDATE
  USING (es_admin_o_dueno_del_negocio(negocio_id));

CREATE POLICY "cat_pereced_eliminar"
  ON categorias_perecedero FOR DELETE
  USING (es_dueno_del_negocio(negocio_id));

-- lotes_producto: ver = todos; crear/actualizar = todos los miembros
--   (empleados reciben mercancía y rotan producto);
--   eliminar = solo admin/dueño
CREATE POLICY "lotes_ver"
  ON lotes_producto FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "lotes_insertar"
  ON lotes_producto FOR INSERT
  WITH CHECK (es_miembro_del_negocio(negocio_id));

CREATE POLICY "lotes_actualizar"
  ON lotes_producto FOR UPDATE
  USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "lotes_eliminar"
  ON lotes_producto FOR DELETE
  USING (es_admin_o_dueno_del_negocio(negocio_id));
