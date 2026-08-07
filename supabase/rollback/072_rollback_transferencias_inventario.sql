-- ROLLBACK 072: quita la transferencia por producto y su bitácora.
--
-- No revierte los movimientos de stock ya hechos: los lotes se quedan en la
-- plaza a la que fueron movidos. Para deshacer un movimiento concreto, hacer la
-- transferencia inversa ANTES de correr esto (la bitácora se pierde aquí).
--
-- transferir_inventario_plaza() (migración 033) no se toca y sigue disponible.

DROP FUNCTION IF EXISTS transferir_stock_plaza(uuid, uuid, numeric, uuid, uuid, uuid, text);

DROP TABLE IF EXISTS transferencias_inventario;
