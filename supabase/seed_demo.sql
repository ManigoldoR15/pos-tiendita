-- seed_demo.sql
-- Datos demo realistas de una tiendita mexicana.
-- Requiere que ya exista un negocio registrado — NO crea negocio nuevo.
-- Ejecutar DESPUÉS de todas las migraciones (001, 002, 003).

DO $$
DECLARE
  v_neg   uuid;
  v_owner uuid;

  -- Métodos de pago
  v_ef    uuid;
  v_td    uuid;
  v_tr    uuid;

  -- Categorías de producto
  v_c_beb  uuid;
  v_c_bot  uuid;
  v_c_dul  uuid;
  v_c_aba  uuid;
  v_c_pap  uuid;

  -- Categorías de gasto
  v_cg_luz uuid;
  v_cg_mer uuid;
  v_cg_ren uuid;
  v_cg_gas uuid;
  v_cg_sue uuid;
  v_cg_agu uuid;

  -- Productos
  v_coca   uuid;
  v_pepsi  uuid;
  v_agua   uuid;
  v_boing  uuid;
  v_jarri  uuid;
  v_sabri  uuid;
  v_takis  uuid;
  v_chicha uuid;
  v_caca   uuid;
  v_paleta uuid;
  v_carlv  uuid;
  v_mazap  uuid;
  v_leche  uuid;
  v_frij   uuid;
  v_pan    uuid;
  v_arroz  uuid;
  v_cuad   uuid;
  v_pluma  uuid;

  -- Clientes
  v_cli1   uuid;
  v_cli2   uuid;
  v_cli3   uuid;

  -- Corte de caja
  v_corte  uuid;

  -- Variable temporal de venta
  v_venta  uuid;

BEGIN

  -- ── 1. Negocio ────────────────────────────────────────────────────────────
  SELECT id, owner_id INTO v_neg, v_owner FROM negocios LIMIT 1;
  IF v_neg IS NULL THEN
    RAISE EXCEPTION 'No hay negocio registrado. Crea uno desde la app primero.';
  END IF;

  -- ── 2. Métodos de pago (existentes) ───────────────────────────────────────
  SELECT id INTO v_ef FROM metodos_pago
    WHERE negocio_id = v_neg AND lower(nombre) LIKE '%efectivo%' LIMIT 1;
  SELECT id INTO v_td FROM metodos_pago
    WHERE negocio_id = v_neg AND (lower(nombre) LIKE '%débit%' OR lower(nombre) LIKE '%debit%') LIMIT 1;
  SELECT id INTO v_tr FROM metodos_pago
    WHERE negocio_id = v_neg AND (lower(nombre) LIKE '%spei%' OR lower(nombre) LIKE '%transfer%') LIMIT 1;

  IF v_ef IS NULL THEN RAISE EXCEPTION 'No hay método de pago "Efectivo". Verifica la configuración del negocio.'; END IF;
  IF v_td IS NULL THEN v_td := v_ef; END IF;
  IF v_tr IS NULL THEN v_tr := v_ef; END IF;

  -- ── 3. Categorías de producto (get o crea) ────────────────────────────────
  SELECT id INTO v_c_beb FROM categorias_producto WHERE negocio_id = v_neg AND nombre = 'Bebidas' LIMIT 1;
  IF v_c_beb IS NULL THEN
    INSERT INTO categorias_producto (negocio_id, nombre) VALUES (v_neg, 'Bebidas') RETURNING id INTO v_c_beb;
  END IF;

  SELECT id INTO v_c_bot FROM categorias_producto WHERE negocio_id = v_neg AND nombre = 'Botanas' LIMIT 1;
  IF v_c_bot IS NULL THEN
    INSERT INTO categorias_producto (negocio_id, nombre) VALUES (v_neg, 'Botanas') RETURNING id INTO v_c_bot;
  END IF;

  SELECT id INTO v_c_dul FROM categorias_producto WHERE negocio_id = v_neg AND nombre = 'Dulces' LIMIT 1;
  IF v_c_dul IS NULL THEN
    INSERT INTO categorias_producto (negocio_id, nombre) VALUES (v_neg, 'Dulces') RETURNING id INTO v_c_dul;
  END IF;

  SELECT id INTO v_c_aba FROM categorias_producto WHERE negocio_id = v_neg AND nombre = 'Abarrotes' LIMIT 1;
  IF v_c_aba IS NULL THEN
    INSERT INTO categorias_producto (negocio_id, nombre) VALUES (v_neg, 'Abarrotes') RETURNING id INTO v_c_aba;
  END IF;

  SELECT id INTO v_c_pap FROM categorias_producto WHERE negocio_id = v_neg AND nombre = 'Papelería' LIMIT 1;
  IF v_c_pap IS NULL THEN
    INSERT INTO categorias_producto (negocio_id, nombre) VALUES (v_neg, 'Papelería') RETURNING id INTO v_c_pap;
  END IF;

  -- ── 4. Categorías de gasto ────────────────────────────────────────────────
  SELECT id INTO v_cg_luz FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%luz%'       LIMIT 1;
  SELECT id INTO v_cg_mer FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%mercanc%'   LIMIT 1;
  SELECT id INTO v_cg_ren FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%renta%'     LIMIT 1;
  SELECT id INTO v_cg_gas FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%gasolina%'  LIMIT 1;
  SELECT id INTO v_cg_sue FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%sueldo%'    LIMIT 1;
  SELECT id INTO v_cg_agu FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%agua%'      LIMIT 1;

  -- Fallback: usar 'otros' si falta alguna categoría
  IF v_cg_luz IS NULL THEN SELECT id INTO v_cg_luz FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%otro%' LIMIT 1; END IF;
  IF v_cg_mer IS NULL THEN SELECT id INTO v_cg_mer FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%otro%' LIMIT 1; END IF;
  IF v_cg_ren IS NULL THEN SELECT id INTO v_cg_ren FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%otro%' LIMIT 1; END IF;
  IF v_cg_gas IS NULL THEN SELECT id INTO v_cg_gas FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%otro%' LIMIT 1; END IF;
  IF v_cg_sue IS NULL THEN SELECT id INTO v_cg_sue FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%otro%' LIMIT 1; END IF;
  IF v_cg_agu IS NULL THEN SELECT id INTO v_cg_agu FROM categorias_gasto WHERE negocio_id = v_neg AND lower(nombre) LIKE '%otro%' LIMIT 1; END IF;

  IF v_cg_luz IS NULL THEN RAISE EXCEPTION 'No hay categorías de gasto. Verifica que el negocio se creó con crear_negocio().'; END IF;

  -- ── 5. Productos ──────────────────────────────────────────────────────────
  -- Bebidas
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_beb, 'Coca-Cola 600ml',     1800, 24, true) RETURNING id INTO v_coca;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_beb, 'Pepsi 600ml',          1600, 18, true) RETURNING id INTO v_pepsi;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_beb, 'Agua Simple 500ml',     900, 30, true) RETURNING id INTO v_agua;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_beb, 'Boing Mango',           1000, 15, true) RETURNING id INTO v_boing;
  -- Jarritos con stock bajo (4 unidades ≤ STOCK_MINIMO 5)
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_beb, 'Jarritos Tamarindo',    1300,  4, true) RETURNING id INTO v_jarri;

  -- Botanas
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_bot, 'Sabritas Originales',   1500, 20, true) RETURNING id INTO v_sabri;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_bot, 'Takis Fuego 62g',       2000, 16, true) RETURNING id INTO v_takis;
  -- Chicharrón con stock bajo (3 ≤ 5)
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_bot, 'Chicharrón Barcel',     1200,  3, true) RETURNING id INTO v_chicha;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_bot, 'Cacahuates Salados',    1000, 25, true) RETURNING id INTO v_caca;

  -- Dulces
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_dul, 'Paleta Payaso',          500, 40, true) RETURNING id INTO v_paleta;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_dul, 'Chocolate Carlos V',     900, 22, true) RETURNING id INTO v_carlv;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_dul, 'Mazapán De La Rosa',     500, 35, true) RETURNING id INTO v_mazap;

  -- Abarrotes
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_aba, 'Leche Lala 1L',         2900, 10, true) RETURNING id INTO v_leche;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_aba, 'Frijoles Bayo 400g',    2400, 14, true) RETURNING id INTO v_frij;
  -- Pan con stock bajo (5 = exactamente el umbral)
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_aba, 'Pan Bimbo Blanco',      4800,  5, true) RETURNING id INTO v_pan;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_aba, 'Arroz Morelos 1kg',     3200, 12, true) RETURNING id INTO v_arroz;

  -- Papelería
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_pap, 'Cuaderno Profesional',  3500,  8, true) RETURNING id INTO v_cuad;
  INSERT INTO productos (negocio_id, categoria_id, nombre, precio_venta, existencias, activo)
    VALUES (v_neg, v_c_pap, 'Pluma BIC Azul',         800, 50, true) RETURNING id INTO v_pluma;

  -- ── 6. Clientes frecuentes ────────────────────────────────────────────────
  INSERT INTO clientes (negocio_id, nombre, telefono)
    VALUES (v_neg, 'Doña Carmen Flores', '5521234567') RETURNING id INTO v_cli1;
  INSERT INTO clientes (negocio_id, nombre, telefono)
    VALUES (v_neg, 'Juan Carlos López',  '5531234567') RETURNING id INTO v_cli2;
  INSERT INTO clientes (negocio_id, nombre)
    VALUES (v_neg, 'Rosa María García')                RETURNING id INTO v_cli3;

  -- ── 7. Corte de caja cerrado (hace 2 días) ────────────────────────────────
  -- Efectivo del día: V9 Jarritos x2 (2600) = 2600
  -- monto_esperado = 50000 (apertura) + 2600 = 52600
  -- monto_contado  = 51100  →  diferencia = -1500 ($15 de faltante)
  INSERT INTO cortes_caja (
    negocio_id, abierto_por, monto_inicial,
    monto_esperado, monto_contado, diferencia,
    estado, fecha_apertura, fecha_cierre,
    notas
  ) VALUES (
    v_neg, v_owner, 50000,
    52600, 51100, -1500,
    'cerrado',
    now() - interval '2 days' + interval '8 hours',
    now() - interval '2 days' + interval '21 hours 30 minutes',
    'Faltaron $15. Revisado sin encontrar el error.'
  ) RETURNING id INTO v_corte;

  -- ── 8. Ventas (12 ventas repartidas en 7 días) ────────────────────────────

  -- Día -6, 09:15 — Coca + Sabritas, efectivo, pago $50
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_ef, 3300, 5000, 1700, 'completada', 0,
            now() - interval '6 days' + interval '9 hours 15 minutes')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_coca,  1, 1800, 1800),
    (v_venta, v_sabri, 1, 1500, 1500);

  -- Día -6, 19:30 — Pepsi + Chicharrón, tarjeta débito
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_td, 2800, NULL, NULL, 'completada', 0,
            now() - interval '6 days' + interval '19 hours 30 minutes')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_pepsi,  1, 1600, 1600),
    (v_venta, v_chicha, 1, 1200, 1200);

  -- Día -5, 08:00 — Agua + Mazapán + Paleta, efectivo
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_ef, 1900, 2000, 100, 'completada', 0,
            now() - interval '5 days' + interval '8 hours')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_agua,   1, 900, 900),
    (v_venta, v_mazap,  1, 500, 500),
    (v_venta, v_paleta, 1, 500, 500);

  -- Día -5, 16:45 — Takis + Boing, 10% descuento (300¢), efectivo
  -- subtotal 3000, descuento 300, total 2700
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_ef, 2700, 3000, 300, 'completada', 300,
            now() - interval '5 days' + interval '16 hours 45 minutes')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_takis, 1, 2000, 2000),
    (v_venta, v_boing, 1, 1000, 1000);

  -- Día -4, 11:00 — Leche + Frijoles, transferencia, cliente Doña Carmen
  INSERT INTO ventas (negocio_id, cliente_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_cli1, v_tr, 5300, NULL, NULL, 'completada', 0,
            now() - interval '4 days' + interval '11 hours')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_leche, 1, 2900, 2900),
    (v_venta, v_frij,  1, 2400, 2400);

  -- Día -4, 20:15 — Coca x2 + Sabritas + Paleta, efectivo
  -- total: 3600 + 1500 + 500 = 5600
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_ef, 5600, 6000, 400, 'completada', 0,
            now() - interval '4 days' + interval '20 hours 15 minutes')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_coca,   2, 1800, 3600),
    (v_venta, v_sabri,  1, 1500, 1500),
    (v_venta, v_paleta, 1,  500,  500);

  -- Día -3, 09:30 — Pan Bimbo + Arroz, efectivo, cliente Juan Carlos
  INSERT INTO ventas (negocio_id, cliente_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_cli2, v_ef, 8000, 10000, 2000, 'completada', 0,
            now() - interval '3 days' + interval '9 hours 30 minutes')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_pan,   1, 4800, 4800),
    (v_venta, v_arroz, 1, 3200, 3200);

  -- Día -3, 15:00 — Cuaderno + Pluma x2, efectivo exacto
  -- total: 3500 + 1600 = 5100
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_ef, 5100, 5100, 0, 'completada', 0,
            now() - interval '3 days' + interval '15 hours')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_cuad,  1, 3500, 3500),
    (v_venta, v_pluma, 2,  800, 1600);

  -- Día -2, 08:45 — Jarritos x2, efectivo (forma parte del corte cerrado)
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, corte_id, created_at)
    VALUES (v_neg, v_ef, 2600, 3000, 400, 'completada', 0, v_corte,
            now() - interval '2 days' + interval '8 hours 45 minutes')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_jarri, 2, 1300, 2600);

  -- Día -2, 17:30 — Coca + Pepsi + Takis, tarjeta débito, cliente Rosa María (corte mismo día)
  INSERT INTO ventas (negocio_id, cliente_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, corte_id, created_at)
    VALUES (v_neg, v_cli3, v_td, 5400, NULL, NULL, 'completada', 0, v_corte,
            now() - interval '2 days' + interval '17 hours 30 minutes')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_coca,  1, 1800, 1800),
    (v_venta, v_pepsi, 1, 1600, 1600),
    (v_venta, v_takis, 1, 2000, 2000);

  -- Día -1, 10:00 — Leche + Pan + Arroz, $9 descuento, efectivo exacto
  -- subtotal: 2900+4800+3200 = 10900, desc 900, total 10000
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_ef, 10000, 10000, 0, 'completada', 900,
            now() - interval '1 day' + interval '10 hours')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_leche, 1, 2900,  2900),
    (v_venta, v_pan,   1, 4800,  4800),
    (v_venta, v_arroz, 1, 3200,  3200);

  -- Día -1, 20:00 — Sabritas + Chocolate + Paleta, efectivo
  INSERT INTO ventas (negocio_id, metodo_pago_id, total, pago_recibido, cambio, estado, descuento, created_at)
    VALUES (v_neg, v_ef, 2900, 3000, 100, 'completada', 0,
            now() - interval '1 day' + interval '20 hours')
    RETURNING id INTO v_venta;
  INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta, v_sabri,  1, 1500, 1500),
    (v_venta, v_carlv,  1,  900,  900),
    (v_venta, v_paleta, 1,  500,  500);

  -- ── 9. Gastos del mes ─────────────────────────────────────────────────────
  -- Agua (hace 6 días)
  INSERT INTO gastos (negocio_id, categoria_id, monto, descripcion, es_personal, fecha)
    VALUES (v_neg, v_cg_agu, 12000, 'Recibo de agua quincenal', false,
            (now() - interval '6 days')::date);

  -- Luz (hace 5 días)
  INSERT INTO gastos (negocio_id, categoria_id, monto, descripcion, es_personal, fecha)
    VALUES (v_neg, v_cg_luz, 48000, 'Recibo CFE', false,
            (now() - interval '5 days')::date);

  -- Mercancía (hace 4 días)
  INSERT INTO gastos (negocio_id, categoria_id, monto, descripcion, es_personal, fecha)
    VALUES (v_neg, v_cg_mer, 220000, 'Compra semanal en Central de Abastos', false,
            (now() - interval '4 days')::date);

  -- Renta (hace 3 días)
  INSERT INTO gastos (negocio_id, categoria_id, monto, descripcion, es_personal, fecha)
    VALUES (v_neg, v_cg_ren, 350000, 'Renta del local — primer quincena', false,
            (now() - interval '3 days')::date);

  -- Gasolina personal (hace 2 días)
  INSERT INTO gastos (negocio_id, categoria_id, monto, descripcion, es_personal, fecha)
    VALUES (v_neg, v_cg_gas, 40000, 'Gasolina para ir al mercado', true,
            (now() - interval '2 days')::date);

  -- Sueldos (hace 1 día)
  INSERT INTO gastos (negocio_id, categoria_id, monto, descripcion, es_personal, fecha)
    VALUES (v_neg, v_cg_sue, 180000, 'Quincena del ayudante', false,
            (now() - interval '1 day')::date);

  RAISE NOTICE 'Seed demo cargado correctamente para negocio %', v_neg;
END $$;
