-- ── Fase 27: Índice pg_trgm para búsqueda rápida en catálogo grande ──

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS productos_nombre_trgm_idx
  ON productos USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS productos_negocio_activo_idx
  ON productos (negocio_id, activo, nombre);
