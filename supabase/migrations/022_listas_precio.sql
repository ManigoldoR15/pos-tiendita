-- ============================================================
-- 022_listas_precio.sql  —  Listas de precios (mayoreo, VIP, etc.)
-- ============================================================
-- Applied via MCP apply_migration on 2026-06-18

-- 1. Lista de precios (cabecera)
CREATE TABLE IF NOT EXISTS listas_precio (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  descripcion text,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listas_precio_negocio ON listas_precio(negocio_id);

ALTER TABLE listas_precio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listas_precio_ver"
  ON listas_precio FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "listas_precio_gestionar"
  ON listas_precio FOR ALL
  USING (es_admin_o_dueno_del_negocio(negocio_id))
  WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));

-- 2. Ítems de lista: precio por producto
CREATE TABLE IF NOT EXISTS lista_precio_items (
  id          uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id    uuid     NOT NULL REFERENCES listas_precio(id) ON DELETE CASCADE,
  negocio_id  uuid     NOT NULL REFERENCES negocios(id),
  producto_id uuid     NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio      integer  NOT NULL CHECK (precio >= 0),
  UNIQUE (lista_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_lp_items_lista    ON lista_precio_items(lista_id);
CREATE INDEX IF NOT EXISTS idx_lp_items_producto ON lista_precio_items(producto_id);

ALTER TABLE lista_precio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_items_ver"
  ON lista_precio_items FOR SELECT
  USING (es_miembro_del_negocio(negocio_id));

CREATE POLICY "lp_items_gestionar"
  ON lista_precio_items FOR ALL
  USING (es_admin_o_dueno_del_negocio(negocio_id))
  WITH CHECK (es_admin_o_dueno_del_negocio(negocio_id));
