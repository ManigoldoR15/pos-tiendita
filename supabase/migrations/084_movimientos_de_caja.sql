-- =============================================================================
-- 084_movimientos_de_caja.sql — sacar y meter dinero del cajón, con nombre
--
-- PROBLEMA: el dueño saca $500 del cajón para llevárselos, o mete $200 de su
-- bolsa porque no había cambio. Ninguna de las dos cosas es una venta, ni un
-- gasto, ni una compra, así que no había dónde registrarlas y el corte salía
-- descuadrado. La salida que quedaba era inventar un gasto falso, que ensucia
-- los reportes de gastos y las ganancias.
--
-- SOLUCIÓN: movimientos_caja. Solo viven dentro de una caja abierta — fuera de
-- un turno no significan nada — y llevan motivo obligatorio, porque un retiro
-- sin razón escrita es justo lo que no se quiere poder hacer.
--
-- PERMISOS: solo dueño o administrador. Un retiro registrado por quien cobra es
-- la forma más fácil de tapar un faltante: se saca el dinero, se registra el
-- retiro y la caja cuadra. Quien atiende el mostrador le avisa al jefe y el jefe
-- lo captura. Mismo criterio que cerrar_corte.
-- =============================================================================

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  corte_id    uuid NOT NULL REFERENCES cortes_caja(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('retiro', 'ingreso')),
  monto       integer NOT NULL CHECK (monto > 0),
  motivo      text NOT NULL CHECK (length(trim(motivo)) > 0),
  creado_por  uuid REFERENCES auth.users(id),
  creado_en   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE movimientos_caja IS
  'Entradas y salidas de efectivo del cajón que no son venta, gasto ni compra: retiros del dueño y aportaciones de cambio. Siempre pertenecen a un corte abierto. Se escriben solo vía registrar_movimiento_caja().';

CREATE INDEX IF NOT EXISTS idx_mov_caja_corte ON movimientos_caja(corte_id);

ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;

-- Se ven (el empleado tiene que poder entender por qué su caja espera menos),
-- pero se escriben solo por RPC.
DROP POLICY IF EXISTS mov_caja_ver ON movimientos_caja;
CREATE POLICY mov_caja_ver ON movimientos_caja
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

REVOKE INSERT, UPDATE, DELETE ON movimientos_caja FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON movimientos_caja TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_movimiento_caja(
  p_negocio_id uuid,
  p_tipo       text,
  p_monto      integer,
  p_motivo     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corte_id uuid;
  v_id       uuid;
BEGIN
  IF NOT es_admin_o_dueno_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede sacar o meter dinero de la caja.';
  END IF;

  IF p_tipo NOT IN ('retiro', 'ingreso') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido.';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero.';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Escribe el motivo del movimiento.';
  END IF;

  -- Fuera de un turno abierto esto no tiene dónde caer.
  v_corte_id := corte_abierto_de(p_negocio_id, local_del_usuario(p_negocio_id));
  IF v_corte_id IS NULL THEN
    RAISE EXCEPTION 'No hay una caja abierta. Abre la caja antes de mover dinero.';
  END IF;

  INSERT INTO movimientos_caja (negocio_id, corte_id, tipo, monto, motivo, creado_por)
  VALUES (p_negocio_id, v_corte_id, p_tipo, p_monto, trim(p_motivo), auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- ── cerrar_corte: + ingresos − retiros ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cerrar_corte(p_corte_id uuid, p_monto_contado integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corte        record;
  v_efectivo_id  uuid;
  v_ventas_ef    integer := 0;
  v_abonos_ap    integer := 0;
  v_abonos_fiado integer := 0;
  v_gastos_ef    integer := 0;
  v_compras_ef   integer := 0;
  v_ingresos     integer := 0;
  v_retiros      integer := 0;
  v_esperado     integer;
  v_diferencia   integer;
BEGIN
  IF p_monto_contado < 0 THEN
    RAISE EXCEPTION 'El monto contado no puede ser negativo.';
  END IF;

  SELECT * INTO v_corte FROM cortes_caja WHERE id = p_corte_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corte de caja no encontrado: %.', p_corte_id;
  END IF;
  IF NOT es_admin_o_dueno_del_negocio(v_corte.negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede cerrar el corte de caja.';
  END IF;
  IF v_corte.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El corte % ya está cerrado.', p_corte_id;
  END IF;

  SELECT id INTO v_efectivo_id
  FROM metodos_pago
  WHERE negocio_id = v_corte.negocio_id AND lower(nombre) = 'efectivo' AND activo = true
  LIMIT 1;

  IF v_efectivo_id IS NOT NULL THEN
    SELECT COALESCE(SUM(GREATEST(0, v.total - COALESCE(f.fiado, 0))), 0)
    INTO   v_ventas_ef
    FROM   ventas v
    LEFT JOIN (
      SELECT venta_id, SUM(subtotal) AS fiado
      FROM   venta_items
      WHERE  es_fiado
      GROUP  BY venta_id
    ) f ON f.venta_id = v.id
    WHERE  v.corte_id       = p_corte_id
      AND  v.metodo_pago_id = v_efectivo_id
      AND  v.estado         = 'completada';

    SELECT COALESCE(SUM(monto), 0) INTO v_abonos_ap
    FROM apartado_abonos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_abonos_fiado
    FROM abonos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_gastos_ef
    FROM gastos
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;

    SELECT COALESCE(SUM(total), 0) INTO v_compras_ef
    FROM compras
    WHERE corte_id = p_corte_id AND metodo_pago_id = v_efectivo_id;
  END IF;

  -- Los movimientos de caja son efectivo por definición: no dependen de que el
  -- negocio tenga un método de pago llamado "Efectivo".
  SELECT COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0),
         COALESCE(SUM(monto) FILTER (WHERE tipo = 'retiro'),  0)
  INTO   v_ingresos, v_retiros
  FROM   movimientos_caja
  WHERE  corte_id = p_corte_id;

  v_esperado := v_corte.monto_inicial + v_ventas_ef + v_abonos_ap + v_abonos_fiado
                + v_ingresos - v_gastos_ef - v_compras_ef - v_retiros;
  v_diferencia := p_monto_contado - v_esperado;

  UPDATE cortes_caja SET
    fecha_cierre   = now(),
    monto_esperado = v_esperado,
    monto_contado  = p_monto_contado,
    diferencia     = v_diferencia,
    estado         = 'cerrado',
    cerrado_por    = auth.uid()
  WHERE id = p_corte_id;

  RETURN jsonb_build_object(
    'corte_id',          p_corte_id,
    'monto_inicial',     v_corte.monto_inicial,
    'ventas_efectivo',   v_ventas_ef,
    'abonos_apartado',   v_abonos_ap,
    'abonos_fiado',      v_abonos_fiado,
    'gastos_efectivo',   v_gastos_ef,
    'compras_efectivo',  v_compras_ef,
    'ingresos_caja',     v_ingresos,
    'retiros_caja',      v_retiros,
    'monto_esperado',    v_esperado,
    'monto_contado',     p_monto_contado,
    'diferencia',        v_diferencia
  );
END;
$function$;

-- ── Hardening de grants (regla 049) ─────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION registrar_movimiento_caja(uuid,text,integer,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION registrar_movimiento_caja(uuid,text,integer,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION cerrar_corte(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cerrar_corte(uuid, integer) TO authenticated, service_role;
