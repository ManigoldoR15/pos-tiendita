-- =============================================================================
-- FASE: Colores de categoría — acento visual en POS y productos
-- =============================================================================

ALTER TABLE categorias_producto
  ADD COLUMN color text CHECK (color IS NULL OR color IN (
    'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'
  ));

COMMENT ON COLUMN categorias_producto.color IS
  'Color de acento para identificar la categoría en la grilla del POS y en productos. NULL = sin color.';
