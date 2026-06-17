-- ============================================================
-- 016_granel.sql  —  Venta por peso/granel + merma
-- ============================================================
-- Applied via MCP apply_migration on 2026-06-16

-- 1. Cambiar columnas de cantidad: integer → numeric(12,3)
ALTER TABLE venta_items
  ALTER COLUMN cantidad TYPE numeric(12,3) USING cantidad::numeric;

ALTER TABLE lotes_producto
  ALTER COLUMN cantidad        TYPE numeric(12,3) USING cantidad::numeric,
  ALTER COLUMN cantidad_actual  TYPE numeric(12,3) USING cantidad_actual::numeric;

ALTER TABLE venta_lotes
  ALTER COLUMN cantidad TYPE numeric(12,3) USING cantidad::numeric;

ALTER TABLE productos
  ALTER COLUMN existencias  TYPE numeric(12,3) USING existencias::numeric,
  ALTER COLUMN stock_minimo TYPE numeric(12,3) USING stock_minimo::numeric;

-- 2. Unidad de medida por producto
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS unidad_medida text NOT NULL DEFAULT 'pieza'
    CHECK (unidad_medida IN ('pieza','kg','g','litro','ml'));

-- 3. Campos de merma en lote
ALTER TABLE lotes_producto
  ADD COLUMN IF NOT EXISTS cantidad_bruta numeric(12,3),
  ADD COLUMN IF NOT EXISTS notas_merma    text;

-- 4. Tabla de ajustes de inventario (log inmutable)
CREATE TABLE IF NOT EXISTS ajustes_inventario (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id       uuid        NOT NULL REFERENCES negocios(id),
  producto_id      uuid        NOT NULL REFERENCES productos(id),
  lote_id          uuid        NOT NULL REFERENCES lotes_producto(id),
  delta            numeric(12,3) NOT NULL,
  cantidad_antes   numeric(12,3) NOT NULL,
  cantidad_despues numeric(12,3) NOT NULL,
  motivo           text        NOT NULL
    CHECK (motivo IN ('merma','robo','error_conteo','devolucion','otro')),
  notas            text,
  registrado_por   uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aj_inv_negocio   ON ajustes_inventario(negocio_id);
CREATE INDEX IF NOT EXISTS idx_aj_inv_producto  ON ajustes_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_aj_inv_lote      ON ajustes_inventario(lote_id);
CREATE INDEX IF NOT EXISTS idx_aj_inv_created   ON ajustes_inventario(created_at);

ALTER TABLE ajustes_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "miembros leen ajustes"
  ON ajustes_inventario FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "miembros insertan ajustes"
  ON ajustes_inventario FOR INSERT
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- 5. Tabla de referencia de merma esperada (vacía)
CREATE TABLE IF NOT EXISTS merma_referencia (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id            uuid        NOT NULL REFERENCES negocios(id),
  producto_id           uuid        REFERENCES productos(id),
  categoria_id          uuid        REFERENCES categorias_perecedero(id),
  porcentaje_esperado   numeric(5,2) NOT NULL
    CHECK (porcentaje_esperado >= 0 AND porcentaje_esperado <= 100),
  notas                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE merma_referencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duenos gestionan merma_referencia"
  ON merma_referencia FOR ALL
  USING (es_dueno_del_negocio(negocio_id))
  WITH CHECK (es_dueno_del_negocio(negocio_id));

CREATE POLICY "miembros leen merma_referencia"
  ON merma_referencia FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

-- 6-8. Funciones actualizadas (registrar_venta, anular_venta, registrar_ajuste_inventario)
-- Applied via CREATE OR REPLACE FUNCTION in MCP call
