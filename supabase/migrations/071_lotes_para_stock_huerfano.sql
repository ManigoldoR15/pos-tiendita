-- =============================================================================
-- 071_lotes_para_stock_huerfano.sql — stock sin lote que no se puede cobrar
--
-- PROBLEMA: la importación masiva de productos (CSV/Excel) insertaba
-- productos.existencias directamente SIN crear un lote. registrar_venta consume
-- por lotes (FEFO) y lanza "Inconsistencia de stock por lotes" cuando no
-- alcanzan, así que TODO catálogo importado quedaba invendible: la pantalla
-- muestra stock y el cobro truena frente al cliente.
--
-- El alta manual de producto (productos/actions.ts) siempre creó su lote — solo
-- el importador tenía el hueco. El importador ya quedó corregido en el mismo
-- cambio que trae esta migración.
--
-- QUÉ HACE: crea el lote faltante con la cantidad que ya declaraba el producto.
-- local_id = NULL (pool global) — no interfiere con multi-plaza.
--
-- INVARIANTE: el trigger trg_sync_existencias recalcula
-- productos.existencias = SUM(lotes activos). Como el lote se crea con la
-- cantidad exacta que ya tenía el producto, ningún número cambia de valor.
-- Verificado antes de aplicar: 18 productos afectados, suma global 863 unidades.
--
-- IDEMPOTENTE: el NOT EXISTS evita duplicar si se corre dos veces.
-- =============================================================================

-- ─── 1. Productos sin variantes ──────────────────────────────────────────────

INSERT INTO lotes_producto (
  negocio_id, producto_id, variante_id,
  cantidad, cantidad_actual,
  fecha_recepcion, ubicacion, fecha_caducidad, local_id, notas, activo
)
SELECT
  p.negocio_id, p.id, NULL,
  p.existencias, p.existencias,
  current_date, 'ambiente', NULL, NULL,
  'Lote inicial generado por migración 071 (stock importado sin lote)', true
FROM productos p
WHERE p.activo
  AND p.existencias > 0
  AND NOT p.tiene_variantes
  AND NOT EXISTS (
    SELECT 1 FROM lotes_producto l
    WHERE l.producto_id = p.id AND l.activo
  );

-- ─── 2. Variantes (talla/color) ──────────────────────────────────────────────
-- El stock de un producto con variantes vive en cada variante; el lote debe
-- llevar variante_id para que el FEFO por variante (migración 063) lo encuentre.

INSERT INTO lotes_producto (
  negocio_id, producto_id, variante_id,
  cantidad, cantidad_actual,
  fecha_recepcion, ubicacion, fecha_caducidad, local_id, notas, activo
)
SELECT
  v.negocio_id, v.producto_id, v.id,
  v.existencias, v.existencias,
  current_date, 'ambiente', NULL, NULL,
  'Lote inicial generado por migración 071 (stock importado sin lote)', true
FROM variantes_producto v
WHERE v.existencias > 0
  AND NOT EXISTS (
    SELECT 1 FROM lotes_producto l
    WHERE l.variante_id = v.id AND l.activo
  );
