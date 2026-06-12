-- ── Fase 22: Proveedores ──

CREATE TABLE IF NOT EXISTS proveedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  telefono    text,
  email       text,
  notas       text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_miembro" ON proveedores
  FOR ALL USING (es_miembro_del_negocio(negocio_id));

-- Columna proveedor_id en gastos (optional FK)
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS proveedores_negocio_idx ON proveedores(negocio_id);
