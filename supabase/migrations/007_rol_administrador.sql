-- ── Fase 26: Tercer rol administrador ──

-- Extender el enum con el nuevo valor
ALTER TYPE rol_negocio ADD VALUE IF NOT EXISTS 'administrador';

-- Permisos del administrador:
-- puede ver ventas, gastos de negocio, proveedores, productos, dashboard
-- NO puede ver: gastos personales (filtrado en frontend), finanzas, márgenes completos, metas, empleados

-- Las RLS policies existentes ya usan es_miembro_del_negocio() que acepta cualquier rol.
-- La restricción de permiso granular se aplica en el código del servidor (getRolActual).
-- No se necesitan nuevas políticas RLS para esta fase.
