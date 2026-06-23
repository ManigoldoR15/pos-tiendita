-- Tara del envase para productos a granel en botes
-- Unidad: la misma que unidad_medida del producto (kg → tara en kg, g → tara en g, etc.)
-- NULL = sin tara (no cambia nada en el flujo de ese producto)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tara numeric(12,3) CHECK (tara IS NULL OR tara >= 0);

COMMENT ON COLUMN productos.tara IS
  'Peso del envase vacío en la misma unidad que unidad_medida. NULL = sin tara.';
