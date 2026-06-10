-- =============================================================================
-- POS México — Schema inicial
-- Migración: 001_schema_inicial.sql
-- Supabase / PostgreSQL 15+
--
-- CONVENCIÓN DE DINERO: siempre en centavos enteros (integer).
--   $49.99 MXN = 4999   |   $0 = 0   |   NUNCA float/numeric para precios.
--
-- MULTI-TENANCY: Supabase RLS con auth.uid().
--   - Todas las tablas de negocio llevan negocio_id (NO user_id directo).
--   - Funciones helper SECURITY DEFINER evitan recursión de RLS.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TRIGGER HELPER — actualiza updated_at automáticamente
-- =============================================================================

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- ENUMs
-- =============================================================================

CREATE TYPE rol_negocio  AS ENUM ('dueno', 'empleado');
CREATE TYPE estado_venta AS ENUM ('completada', 'cancelada');
CREATE TYPE estado_corte AS ENUM ('abierto', 'cerrado');

-- =============================================================================
-- TABLA: negocios
-- =============================================================================

CREATE TABLE negocios (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL,
  owner_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE negocios IS
  'Negocios registrados en el sistema. Un usuario puede ser dueño de varios negocios. Usar siempre crear_negocio() para crear uno nuevo — inserta directo no siembra los datos iniciales.';

CREATE INDEX idx_negocios_owner ON negocios(owner_id);

CREATE TRIGGER trg_negocios_updated_at
  BEFORE UPDATE ON negocios
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- =============================================================================
-- TABLA: usuarios_negocio
-- =============================================================================

CREATE TABLE usuarios_negocio (
  negocio_id uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol        rol_negocio NOT NULL DEFAULT 'empleado',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, user_id)
);

COMMENT ON TABLE usuarios_negocio IS
  'Relación muchos-a-muchos entre usuarios y negocios con soporte de roles. En v1 solo habrá dueños, pero el schema ya soporta empleados sin re-arquitectura.';

CREATE INDEX idx_usuarios_negocio_user ON usuarios_negocio(user_id);

-- =============================================================================
-- FUNCIONES HELPER DE RLS
-- SECURITY DEFINER: corren con privilegios del owner (bypassean RLS
-- en usuarios_negocio), evitando recursión infinita en las policies.
-- Deben crearse DESPUÉS de las tablas que consultan.
-- =============================================================================

CREATE OR REPLACE FUNCTION es_miembro_del_negocio(negocio_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.usuarios_negocio
    WHERE  negocio_id = negocio_uuid
      AND  user_id    = auth.uid()
  );
$$;

COMMENT ON FUNCTION es_miembro_del_negocio(uuid) IS
  'True si el usuario autenticado pertenece al negocio (cualquier rol). SECURITY DEFINER para evitar recursión en policies RLS.';

CREATE OR REPLACE FUNCTION es_dueno_del_negocio(negocio_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.usuarios_negocio
    WHERE  negocio_id = negocio_uuid
      AND  user_id    = auth.uid()
      AND  rol        = 'dueno'
  );
$$;

COMMENT ON FUNCTION es_dueno_del_negocio(uuid) IS
  'True si el usuario autenticado es dueño del negocio. SECURITY DEFINER para evitar recursión en policies RLS.';

-- =============================================================================
-- RLS: negocios
-- =============================================================================

ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "negocios_ver" ON negocios
  FOR SELECT USING (es_miembro_del_negocio(id));

-- Cualquier usuario autenticado puede crear su propio negocio
CREATE POLICY "negocios_crear" ON negocios
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Solo el dueño original puede editar o eliminar el negocio
CREATE POLICY "negocios_editar" ON negocios
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "negocios_eliminar" ON negocios
  FOR DELETE USING (owner_id = auth.uid());

-- =============================================================================
-- RLS: usuarios_negocio
-- =============================================================================

ALTER TABLE usuarios_negocio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_negocio_ver" ON usuarios_negocio
  FOR SELECT USING (es_miembro_del_negocio(negocio_id));

-- Solo el dueño puede agregar o quitar miembros
CREATE POLICY "usuarios_negocio_agregar" ON usuarios_negocio
  FOR INSERT WITH CHECK (es_dueno_del_negocio(negocio_id));

CREATE POLICY "usuarios_negocio_quitar" ON usuarios_negocio
  FOR DELETE USING (es_dueno_del_negocio(negocio_id));

-- =============================================================================
-- TABLA: categorias_producto
-- =============================================================================

CREATE TABLE categorias_producto (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     text        NOT NULL,
  orden      integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE categorias_producto IS
  'Categorías de productos definidas por cada negocio (abarrotes, refrescos, dulces, etc.). No hay catálogo global — cada tienda define las suyas.';

CREATE INDEX idx_cat_producto_negocio ON categorias_producto(negocio_id);

ALTER TABLE categorias_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_producto_todo" ON categorias_producto
  USING     (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- =============================================================================
-- TABLA: productos
-- =============================================================================

CREATE TABLE productos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre        text        NOT NULL,
  precio_venta  integer     NOT NULL CHECK (precio_venta >= 0),
  precio_costo  integer              CHECK (precio_costo >= 0),
  existencias   integer     NOT NULL DEFAULT 0,
  categoria_id  uuid        REFERENCES categorias_producto(id) ON DELETE SET NULL,
  codigo_barras text,
  stock_minimo  integer     NOT NULL DEFAULT 0,
  activo        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE productos IS
  'Catálogo de productos de cada negocio. Precios en centavos enteros ($49.99 MXN = 4999). Las existencias se decrementan en servidor dentro de registrar_venta(), nunca por el cliente directamente.';

COMMENT ON COLUMN productos.precio_venta  IS 'Precio de venta al público, en centavos enteros.';
COMMENT ON COLUMN productos.precio_costo  IS 'Precio de costo, en centavos enteros. Nullable: no siempre se conoce.';
COMMENT ON COLUMN productos.existencias   IS 'Unidades en inventario. Se descuenta transaccionalmente en registrar_venta().';
COMMENT ON COLUMN productos.stock_minimo  IS 'Umbral de alerta de reposición. 0 = sin alerta.';

CREATE INDEX idx_productos_negocio   ON productos(negocio_id);
CREATE INDEX idx_productos_categoria ON productos(categoria_id) WHERE categoria_id IS NOT NULL;
CREATE INDEX idx_productos_barras    ON productos(negocio_id, codigo_barras) WHERE codigo_barras IS NOT NULL;

CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_todo" ON productos
  USING     (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- =============================================================================
-- TABLA: clientes
-- =============================================================================

CREATE TABLE clientes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     text        NOT NULL,
  telefono   text,
  notas      text,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE clientes IS
  'Clientes registrados por negocio. El cliente es OPCIONAL en las ventas — la mayoría son ventas anónimas. Sin email obligatorio, sin restricción de unicidad en nombre o teléfono.';

CREATE INDEX idx_clientes_negocio ON clientes(negocio_id);

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_todo" ON clientes
  USING     (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- =============================================================================
-- TABLA: metodos_pago
-- =============================================================================

CREATE TABLE metodos_pago (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     text        NOT NULL,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE metodos_pago IS
  'Métodos de pago POR NEGOCIO (Efectivo, Tarjeta débito, Tarjeta crédito, Transferencia SPEI, etc.). Intencionalmente no globales — FinOpenPOS los tenía globales y generaba contaminación entre tenants.';

CREATE INDEX idx_metodos_pago_negocio ON metodos_pago(negocio_id);

ALTER TABLE metodos_pago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metodos_pago_todo" ON metodos_pago
  USING     (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- =============================================================================
-- TABLA: cortes_caja
-- Declarada antes de ventas porque ventas la referencia vía corte_id.
-- =============================================================================

CREATE TABLE cortes_caja (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     uuid         NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  abierto_por    uuid         NOT NULL REFERENCES auth.users(id),
  monto_inicial  integer      NOT NULL DEFAULT 0 CHECK (monto_inicial >= 0),
  fecha_apertura timestamptz  NOT NULL DEFAULT now(),
  fecha_cierre   timestamptz,
  monto_esperado integer               CHECK (monto_esperado >= 0),
  monto_contado  integer               CHECK (monto_contado >= 0),
  diferencia     integer,
  estado         estado_corte NOT NULL DEFAULT 'abierto',
  notas          text,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE cortes_caja IS
  'Sesiones de caja: apertura con fondo inicial → operaciones del día → cierre con conteo físico y diferencia calculada (faltante o sobrante). La restricción de índice parcial garantiza un solo corte abierto por negocio.';

COMMENT ON COLUMN cortes_caja.monto_inicial  IS 'Fondo de caja con el que inicia el turno, en centavos.';
COMMENT ON COLUMN cortes_caja.monto_esperado IS 'Calculado al cerrar: monto_inicial + ventas en efectivo del corte.';
COMMENT ON COLUMN cortes_caja.monto_contado  IS 'Lo que el dueño contó físicamente al cerrar, en centavos.';
COMMENT ON COLUMN cortes_caja.diferencia     IS 'monto_contado − monto_esperado. Negativo = faltante, positivo = sobrante.';

CREATE INDEX idx_cortes_negocio        ON cortes_caja(negocio_id);
CREATE INDEX idx_cortes_negocio_estado ON cortes_caja(negocio_id, estado);

-- Solo puede existir UN corte abierto por negocio al mismo tiempo
CREATE UNIQUE INDEX idx_cortes_un_abierto
  ON cortes_caja(negocio_id)
  WHERE estado = 'abierto';

ALTER TABLE cortes_caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cortes_caja_todo" ON cortes_caja
  USING     (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- =============================================================================
-- TABLA: ventas
-- =============================================================================

CREATE TABLE ventas (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     uuid         NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id     uuid         REFERENCES clientes(id) ON DELETE SET NULL,
  metodo_pago_id uuid         NOT NULL REFERENCES metodos_pago(id),
  total          integer      NOT NULL CHECK (total >= 0),
  pago_recibido  integer               CHECK (pago_recibido >= 0),
  cambio         integer               CHECK (cambio >= 0),
  corte_id       uuid         REFERENCES cortes_caja(id) ON DELETE SET NULL,
  estado         estado_venta NOT NULL DEFAULT 'completada',
  notas          text,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE ventas IS
  'Registro de ventas del negocio. cliente_id es NULLABLE — la venta anónima es el caso default en tienditas. Precios en centavos enteros.';

COMMENT ON COLUMN ventas.total         IS 'Suma de subtotales de los venta_items, en centavos.';
COMMENT ON COLUMN ventas.pago_recibido IS 'Dinero entregado por el cliente. Nullable para pagos exactos o con tarjeta.';
COMMENT ON COLUMN ventas.cambio        IS 'Cambio devuelto = pago_recibido − total. Calculado en registrar_venta().';
COMMENT ON COLUMN ventas.corte_id      IS 'Corte de caja activo al momento de la venta. NULL si no había corte abierto.';

CREATE INDEX idx_ventas_negocio       ON ventas(negocio_id);
CREATE INDEX idx_ventas_created_at    ON ventas(created_at);
CREATE INDEX idx_ventas_negocio_fecha ON ventas(negocio_id, created_at);
CREATE INDEX idx_ventas_corte         ON ventas(corte_id)    WHERE corte_id   IS NOT NULL;
CREATE INDEX idx_ventas_cliente       ON ventas(cliente_id)  WHERE cliente_id IS NOT NULL;

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ventas_todo" ON ventas
  USING     (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- =============================================================================
-- TABLA: venta_items
-- =============================================================================

CREATE TABLE venta_items (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        uuid    NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     uuid    NOT NULL REFERENCES productos(id),
  cantidad        integer NOT NULL CHECK (cantidad > 0),
  precio_unitario integer NOT NULL CHECK (precio_unitario >= 0),
  subtotal        integer NOT NULL CHECK (subtotal >= 0)
);

COMMENT ON TABLE venta_items IS
  'Líneas de detalle de cada venta. precio_unitario es un SNAPSHOT del precio al momento exacto de la transacción — no depende del precio_venta actual del producto y jamás cambia.';

COMMENT ON COLUMN venta_items.precio_unitario IS
  'Snapshot del precio al registrar la venta. Inmutable aunque el producto cambie de precio después.';

CREATE INDEX idx_venta_items_venta    ON venta_items(venta_id);
CREATE INDEX idx_venta_items_producto ON venta_items(producto_id);

ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;

-- venta_items no tiene negocio_id propio; el acceso se valida vía la venta padre
CREATE POLICY "venta_items_ver" ON venta_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE  v.id = venta_id
        AND  es_miembro_del_negocio(v.negocio_id)
    )
  );

CREATE POLICY "venta_items_crear" ON venta_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE  v.id = venta_id
        AND  es_miembro_del_negocio(v.negocio_id)
    )
  );

CREATE POLICY "venta_items_eliminar" ON venta_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE  v.id = venta_id
        AND  es_miembro_del_negocio(v.negocio_id)
    )
  );

-- =============================================================================
-- TABLA: categorias_gasto
-- =============================================================================

CREATE TABLE categorias_gasto (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     text        NOT NULL,
  orden      integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE categorias_gasto IS
  'Categorías de gastos por negocio. Se siembran automáticamente 9 categorías estándar al crear el negocio vía crear_negocio().';

CREATE INDEX idx_cat_gasto_negocio ON categorias_gasto(negocio_id);

ALTER TABLE categorias_gasto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_gasto_todo" ON categorias_gasto
  USING     (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- =============================================================================
-- TABLA: gastos
-- =============================================================================

CREATE TABLE gastos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   uuid        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  categoria_id uuid        NOT NULL REFERENCES categorias_gasto(id),
  monto        integer     NOT NULL CHECK (monto > 0),
  descripcion  text,
  es_personal  boolean     NOT NULL DEFAULT false,
  fecha        date        NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gastos IS
  'Gastos del negocio y personales del dueño. es_personal separa ambos para calcular la utilidad neta real del negocio en el dashboard.';

COMMENT ON COLUMN gastos.monto      IS 'Monto del gasto en centavos enteros.';
COMMENT ON COLUMN gastos.es_personal IS 'true = gasto personal del dueño; false = gasto del negocio. Solo los gastos del negocio reducen la utilidad neta.';
COMMENT ON COLUMN gastos.fecha      IS 'Tipo date (no timestamptz) para facilitar filtros por día, semana o mes sin conversión de zona horaria.';

CREATE INDEX idx_gastos_negocio       ON gastos(negocio_id);
CREATE INDEX idx_gastos_fecha         ON gastos(fecha);
CREATE INDEX idx_gastos_negocio_fecha ON gastos(negocio_id, fecha);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gastos_todo" ON gastos
  USING     (es_miembro_del_negocio(negocio_id))
  WITH CHECK (es_miembro_del_negocio(negocio_id));

-- =============================================================================
-- FUNCIÓN: crear_negocio(p_nombre text) → uuid
--
-- Crea el negocio, registra al creador como dueño y siembra los datos
-- iniciales (categorías de gasto y métodos de pago), todo en una sola
-- transacción. SIEMPRE usar esta función en lugar de INSERT directo.
-- =============================================================================

CREATE OR REPLACE FUNCTION crear_negocio(p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_negocio_id uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Se requiere autenticación para crear un negocio.';
  END IF;

  IF p_nombre IS NULL OR trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre del negocio es obligatorio.';
  END IF;

  INSERT INTO negocios (nombre, owner_id)
  VALUES (trim(p_nombre), v_uid)
  RETURNING id INTO v_negocio_id;

  INSERT INTO usuarios_negocio (negocio_id, user_id, rol)
  VALUES (v_negocio_id, v_uid, 'dueno');

  -- Categorías de gasto estándar para una tiendita mexicana
  INSERT INTO categorias_gasto (negocio_id, nombre, orden) VALUES
    (v_negocio_id, 'Luz',                 1),
    (v_negocio_id, 'Agua',                2),
    (v_negocio_id, 'Gas',                 3),
    (v_negocio_id, 'Renta',               4),
    (v_negocio_id, 'Gasolina',            5),
    (v_negocio_id, 'Sueldos',             6),
    (v_negocio_id, 'Mercancía',           7),
    (v_negocio_id, 'Internet y teléfono', 8),
    (v_negocio_id, 'Otro',                9);

  -- Métodos de pago habituales en México
  INSERT INTO metodos_pago (negocio_id, nombre) VALUES
    (v_negocio_id, 'Efectivo'),
    (v_negocio_id, 'Tarjeta débito'),
    (v_negocio_id, 'Tarjeta crédito'),
    (v_negocio_id, 'Transferencia (SPEI)');

  RETURN v_negocio_id;
END;
$$;

COMMENT ON FUNCTION crear_negocio(text) IS
  'Crea un negocio de forma transaccional: inserta el negocio, registra al creador como dueño, siembra 9 categorías de gasto y 4 métodos de pago estándar. Devuelve el UUID del negocio.';

-- =============================================================================
-- FUNCIÓN: registrar_venta(...) → uuid
--
-- Transaccional y segura contra race conditions de stock:
--   1. SELECT FOR UPDATE bloquea los productos mientras se valida el stock.
--   2. Si algún producto no tiene stock suficiente, lanza excepción con nombre.
--   3. Inserta venta + venta_items con precio SNAPSHOT del momento actual.
--   4. Descuenta existencias en servidor (corrección del bug de FinOpenPOS).
--   5. Asocia la venta al corte de caja abierto si existe.
--
-- Formato de p_items: [{"producto_id": "uuid", "cantidad": 2}, ...]
-- =============================================================================

CREATE OR REPLACE FUNCTION registrar_venta(
  p_negocio_id     uuid,
  p_items          jsonb,
  p_metodo_pago_id uuid,
  p_cliente_id     uuid    DEFAULT NULL,
  p_pago_recibido  integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta_id    uuid;
  v_total       integer := 0;
  v_cambio      integer;
  v_corte_id    uuid;
  v_item        jsonb;
  v_prod_id     uuid;
  v_cantidad    integer;
  v_precio      integer;
  v_existencias integer;
  v_nombre_prod text;
  v_subtotal    integer;
BEGIN
  IF NOT es_miembro_del_negocio(p_negocio_id) THEN
    RAISE EXCEPTION 'Sin acceso al negocio %.', p_negocio_id;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto.';
  END IF;

  -- ------------------------------------------------------------------
  -- Pasada 1: validar stock y calcular total
  -- FOR UPDATE bloquea las filas para evitar que otra transacción
  -- concurrent venda el mismo stock en paralelo (race condition).
  -- ------------------------------------------------------------------
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id  := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %.', v_prod_id;
    END IF;

    SELECT nombre, precio_venta, existencias
    INTO   v_nombre_prod, v_precio, v_existencias
    FROM   productos
    WHERE  id         = v_prod_id
      AND  negocio_id = p_negocio_id
      AND  activo     = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo: %.', v_prod_id;
    END IF;

    IF v_existencias < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, solicitado: %.',
        v_nombre_prod, v_existencias, v_cantidad;
    END IF;

    v_total := v_total + (v_precio * v_cantidad);
  END LOOP;

  -- Validar pago recibido
  IF p_pago_recibido IS NOT NULL THEN
    IF p_pago_recibido < v_total THEN
      RAISE EXCEPTION 'Pago insuficiente. Total: %, recibido: %.', v_total, p_pago_recibido;
    END IF;
    v_cambio := p_pago_recibido - v_total;
  END IF;

  -- Asociar al corte de caja abierto si existe
  SELECT id INTO v_corte_id
  FROM   cortes_caja
  WHERE  negocio_id = p_negocio_id
    AND  estado     = 'abierto'
  LIMIT 1;

  -- Insertar cabecera de venta
  INSERT INTO ventas (
    negocio_id, cliente_id, metodo_pago_id,
    total, pago_recibido, cambio, corte_id, estado
  ) VALUES (
    p_negocio_id, p_cliente_id, p_metodo_pago_id,
    v_total, p_pago_recibido, v_cambio, v_corte_id, 'completada'
  )
  RETURNING id INTO v_venta_id;

  -- ------------------------------------------------------------------
  -- Pasada 2: insertar items y descontar existencias
  -- Las filas ya están bloqueadas por el FOR UPDATE de la pasada 1
  -- (misma transacción), por lo que el SELECT de precio es consistente.
  -- ------------------------------------------------------------------
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id  := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;

    -- Precio snapshot: leído del DB en la misma transacción = precio exacto al momento de la venta
    SELECT precio_venta INTO v_precio
    FROM   productos
    WHERE  id = v_prod_id;

    v_subtotal := v_precio * v_cantidad;

    INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (v_venta_id, v_prod_id, v_cantidad, v_precio, v_subtotal);

    UPDATE productos
    SET    existencias = existencias - v_cantidad
    WHERE  id         = v_prod_id
      AND  negocio_id = p_negocio_id;
  END LOOP;

  RETURN v_venta_id;
END;
$$;

COMMENT ON FUNCTION registrar_venta(uuid, jsonb, uuid, uuid, integer) IS
  'Registra una venta de forma transaccional con SELECT FOR UPDATE. Valida stock, inserta venta + items con precio snapshot y descuenta existencias en servidor. Items: [{"producto_id":"uuid","cantidad":2}].';

-- =============================================================================
-- FUNCIÓN: cerrar_corte(p_corte_id uuid, p_monto_contado int) → jsonb
--
-- Calcula el monto esperado (monto_inicial + ventas en efectivo del corte),
-- registra el conteo físico del dueño, calcula la diferencia y cierra el
-- corte. Devuelve jsonb con el resumen completo para mostrar en pantalla.
-- =============================================================================

CREATE OR REPLACE FUNCTION cerrar_corte(
  p_corte_id      uuid,
  p_monto_contado integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corte       record;
  v_efectivo_id uuid;
  v_ventas_ef   integer := 0;
  v_esperado    integer;
  v_diferencia  integer;
BEGIN
  IF p_monto_contado < 0 THEN
    RAISE EXCEPTION 'El monto contado no puede ser negativo.';
  END IF;

  SELECT * INTO v_corte
  FROM   cortes_caja
  WHERE  id = p_corte_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corte de caja no encontrado: %.', p_corte_id;
  END IF;

  IF NOT es_miembro_del_negocio(v_corte.negocio_id) THEN
    RAISE EXCEPTION 'Sin acceso a este corte de caja.';
  END IF;

  IF v_corte.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El corte % ya está cerrado.', p_corte_id;
  END IF;

  -- Buscar el método de pago "Efectivo" del negocio (sembrado por crear_negocio)
  SELECT id INTO v_efectivo_id
  FROM   metodos_pago
  WHERE  negocio_id  = v_corte.negocio_id
    AND  lower(nombre) = 'efectivo'
    AND  activo      = true
  LIMIT 1;

  -- Sumar ventas en efectivo completadas durante este corte
  IF v_efectivo_id IS NOT NULL THEN
    SELECT COALESCE(SUM(total), 0) INTO v_ventas_ef
    FROM   ventas
    WHERE  corte_id       = p_corte_id
      AND  metodo_pago_id = v_efectivo_id
      AND  estado         = 'completada';
  END IF;

  -- v1 simple: monto esperado = fondo inicial + ventas en efectivo del corte
  v_esperado   := v_corte.monto_inicial + v_ventas_ef;
  v_diferencia := p_monto_contado - v_esperado;

  UPDATE cortes_caja SET
    fecha_cierre   = now(),
    monto_esperado = v_esperado,
    monto_contado  = p_monto_contado,
    diferencia     = v_diferencia,
    estado         = 'cerrado'
  WHERE id = p_corte_id;

  RETURN jsonb_build_object(
    'corte_id',        p_corte_id,
    'monto_inicial',   v_corte.monto_inicial,
    'ventas_efectivo', v_ventas_ef,
    'monto_esperado',  v_esperado,
    'monto_contado',   p_monto_contado,
    'diferencia',      v_diferencia
  );
END;
$$;

COMMENT ON FUNCTION cerrar_corte(uuid, integer) IS
  'Cierra un corte de caja. Calcula monto_esperado = monto_inicial + ventas en efectivo del corte, registra el conteo físico y la diferencia (negativo = faltante). Devuelve jsonb con resumen.';

-- =============================================================================
-- QUERIES DE PRUEBA
-- Ejecutar en el SQL Editor de Supabase después de aplicar el schema.
-- Reemplaza las variables <...> con UUIDs reales de tu proyecto.
-- =============================================================================

/*

-- 1. Crear un negocio (requiere sesión activa de Supabase Auth)
SELECT crear_negocio('Tienda La Lupita') AS negocio_id;
-- Guarda el UUID devuelto, lo necesitas en las queries siguientes.

-- 2. Verificar que se sembraron los datos iniciales
-- Sustituye <negocio_id> con el UUID del paso 1.
SELECT 'categorias_gasto' AS tabla, nombre, orden::text AS detalle
FROM   categorias_gasto
WHERE  negocio_id = '<negocio_id>'
UNION ALL
SELECT 'metodos_pago', nombre, CASE WHEN activo THEN 'activo' ELSE 'inactivo' END
FROM   metodos_pago
WHERE  negocio_id = '<negocio_id>'
ORDER BY tabla, detalle;

-- 3. Registrar una venta de prueba
-- Obtén primero los IDs necesarios:
--   SELECT id, nombre FROM metodos_pago WHERE negocio_id = '<negocio_id>';
--   SELECT id, nombre, precio_venta, existencias FROM productos WHERE negocio_id = '<negocio_id>';
SELECT registrar_venta(
  '<negocio_id>',
  '[{"producto_id": "<producto_id>", "cantidad": 2}]'::jsonb,
  '<metodo_pago_id_efectivo>',
  NULL,   -- venta anónima (sin cliente registrado)
  5000    -- pagó $50.00 en efectivo → cambio calculado automáticamente
) AS venta_id;

*/
