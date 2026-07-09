-- =============================================================================
-- 064_giro_ropa.sql — nuevo giro 'ropa' en tipo_negocio
-- Para vendedores de ropa: el alta usa este giro para preconfigurar el negocio
-- (variantes talla/color activas, sin caducidad, categorías y gastos de ropa).
-- =============================================================================

ALTER TABLE negocios DROP CONSTRAINT negocios_tipo_negocio_check;
ALTER TABLE negocios ADD CONSTRAINT negocios_tipo_negocio_check
  CHECK (tipo_negocio IN ('tiendita','abarrotes','carniceria','taqueria','torteria','fruteria','farmacia','papeleria','ferreteria','cremeria','tortilleria','panaderia','verduleria','ropa','otro'));
