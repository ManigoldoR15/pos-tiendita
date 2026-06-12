-- ── Fase 25: Metas del negocio ──

CREATE TABLE IF NOT EXISTS metas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  mes           date NOT NULL,   -- primer día del mes: '2026-06-01'
  meta_ventas   integer NOT NULL CHECK (meta_ventas > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, mes)
);

ALTER TABLE metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_miembro" ON metas
  FOR ALL USING (es_miembro_del_negocio(negocio_id));

CREATE INDEX IF NOT EXISTS metas_negocio_mes_idx ON metas(negocio_id, mes DESC);
