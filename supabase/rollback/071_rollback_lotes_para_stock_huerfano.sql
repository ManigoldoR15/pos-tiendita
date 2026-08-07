-- ROLLBACK 071: elimina los lotes generados por la migración 071.
--
-- Se identifican por su nota. Al borrarlos, el trigger trg_sync_existencias
-- recalcula productos.existencias = SUM(lotes activos) y esos productos vuelven
-- a quedar en 0 — que es exactamente el estado previo desde el punto de vista de
-- los lotes, pero NO desde el de productos.existencias (antes decía 30, 12, …).
--
-- Por eso este rollback restaura también el valor declarado, tomándolo de la
-- cantidad del propio lote antes de borrarlo.
--
-- ⚠ Correr SOLO si ningún lote de estos ya fue consumido por una venta, o los
-- números quedarán inflados respecto a lo realmente vendido.

BEGIN;

CREATE TEMP TABLE _rb071 AS
SELECT producto_id, variante_id, cantidad
FROM   lotes_producto
WHERE  notas = 'Lote inicial generado por migración 071 (stock importado sin lote)';

DELETE FROM lotes_producto
WHERE notas = 'Lote inicial generado por migración 071 (stock importado sin lote)';

-- Restaurar el valor que productos/variantes declaraban antes de la migración
UPDATE variantes_producto v
SET    existencias = r.cantidad
FROM   _rb071 r
WHERE  r.variante_id = v.id;

UPDATE productos p
SET    existencias = r.cantidad
FROM   _rb071 r
WHERE  r.variante_id IS NULL AND r.producto_id = p.id;

DROP TABLE _rb071;

COMMIT;
