-- ── Fase 23: Presupuesto por categoría de gasto ──
ALTER TABLE categorias_gasto
  ADD COLUMN IF NOT EXISTS presupuesto integer DEFAULT NULL;
