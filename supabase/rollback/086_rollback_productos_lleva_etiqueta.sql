-- Rollback de 086: se pierde qué productos marcó el dueño para etiqueta.
-- La pantalla de Etiquetas vuelve a enlistar todo el catálogo (desplegar
-- antes el código que ya no lee lleva_etiqueta).

DROP TRIGGER IF EXISTS trg_productos_lleva_etiqueta ON productos;
DROP FUNCTION IF EXISTS public.productos_lleva_etiqueta_default();
ALTER TABLE productos DROP COLUMN IF EXISTS lleva_etiqueta;
