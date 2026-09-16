-- =============================================================================
-- 086_productos_lleva_etiqueta.sql — qué productos llevan etiqueta impresa
--
-- PROBLEMA. La pantalla de Etiquetas enlista TODO el catálogo. Pero muchos
-- productos ya traen su código de barras de fábrica (refrescos, latas) y no
-- necesitan etiqueta; los que sí la llevan (quesos, granel, cosas hechas en
-- casa) quedan revueltos entre cientos y hay que buscarlos cada vez.
--
-- SOLUCIÓN. Una marca por producto, `lleva_etiqueta`, que el dueño prende o
-- apaga con un interruptor (en la ficha del producto o en la misma pantalla de
-- Etiquetas). Etiquetas muestra primero solo los marcados.
--
-- Valor inicial (existentes y altas que no la manden, p. ej. importar): lleva
-- etiqueta si no tiene código o si su código es interno ("20" + 10 dígitos,
-- los que genera la pantalla de Etiquetas). Un código comercial = ya viene
-- impreso en el empaque = no lleva.
--
-- Rollback: supabase/rollback/086_rollback_productos_lleva_etiqueta.sql
-- =============================================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS lleva_etiqueta boolean;

UPDATE productos
SET    lleva_etiqueta = (codigo_barras IS NULL OR codigo_barras ~ '^20\d{10}$')
WHERE  lleva_etiqueta IS NULL;

CREATE OR REPLACE FUNCTION public.productos_lleva_etiqueta_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.lleva_etiqueta IS NULL THEN
    NEW.lleva_etiqueta := (NEW.codigo_barras IS NULL OR NEW.codigo_barras ~ '^20\d{10}$');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_productos_lleva_etiqueta ON productos;
CREATE TRIGGER trg_productos_lleva_etiqueta
  BEFORE INSERT ON productos
  FOR EACH ROW EXECUTE FUNCTION public.productos_lleva_etiqueta_default();

ALTER TABLE productos ALTER COLUMN lleva_etiqueta SET NOT NULL;

COMMENT ON COLUMN productos.lleva_etiqueta IS
  'true = el negocio le imprime etiqueta de código de barras (sale en /productos/etiquetas). Si llega NULL al insertar, el trigger la calcula por el código de barras.';
