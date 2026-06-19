-- ─── PARTE 1: tabla locales (preparación multi-local) ──────────────────────────
CREATE TABLE IF NOT EXISTS locales (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     text NOT NULL DEFAULT 'Principal',
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE locales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locales_ver"     ON locales FOR SELECT USING (es_miembro_del_negocio(negocio_id));
CREATE POLICY "locales_admin"   ON locales FOR INSERT WITH CHECK (es_dueno_del_negocio(negocio_id));
CREATE POLICY "locales_update"  ON locales FOR UPDATE USING (es_dueno_del_negocio(negocio_id));
CREATE POLICY "locales_delete"  ON locales FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- Seed: un local "Principal" por cada negocio existente
INSERT INTO locales (negocio_id, nombre)
SELECT id, 'Principal' FROM negocios
ON CONFLICT DO NOTHING;

-- local_id en cortes_caja (nullable para compatibilidad con cajas ya abiertas)
ALTER TABLE cortes_caja
  ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES locales(id);

-- ─── PARTE 2: tabla notificaciones ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN (
    'ajuste_inventario',
    'diferencia_caja',
    'fiado',
    'fiado_lista_negra',
    'mensaje_empleado'
  )),
  titulo     text NOT NULL,
  mensaje    text NOT NULL,
  url        text,
  leido      boolean NOT NULL DEFAULT false,
  leido_en   timestamptz,
  creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Solo dueño/admin lee notificaciones
CREATE POLICY "notif_ver" ON notificaciones
  FOR SELECT
  USING (es_admin_o_dueno_del_negocio(negocio_id));

-- Cualquier miembro puede insertar ÚNICAMENTE mensajes de empleado
-- Las notificaciones de sistema se crean vía service_role (bypass RLS)
CREATE POLICY "notif_mensaje_empleado" ON notificaciones
  FOR INSERT
  WITH CHECK (
    tipo = 'mensaje_empleado'
    AND es_miembro_del_negocio(negocio_id)
  );

-- Solo dueño puede marcar como leído
CREATE POLICY "notif_marcar_leido" ON notificaciones
  FOR UPDATE
  USING (es_dueno_del_negocio(negocio_id));

-- ─── índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS notif_negocio_leido ON notificaciones (negocio_id, leido, created_at DESC);
CREATE INDEX IF NOT EXISTS notif_negocio_tipo  ON notificaciones (negocio_id, tipo);
