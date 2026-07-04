-- ROLLBACK 042: elimina el RPC de pagos y la tabla pagos_suscripcion.
-- OJO: dropea la tabla con su historial de pagos — solo usar si la fase 3
-- se descarta por completo. negocios.suscripcion_fin conserva los valores
-- que los pagos hayan dejado (revertirlos sería inventar datos).

DROP FUNCTION IF EXISTS sa_registrar_pago(uuid, integer, text, date, text, text);
DROP TABLE IF EXISTS pagos_suscripcion;
