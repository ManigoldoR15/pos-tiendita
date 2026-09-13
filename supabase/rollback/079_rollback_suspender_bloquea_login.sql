-- Rollback de 079_suspender_bloquea_login.sql
--
-- Quita el trigger. No toca los bans ya aplicados: si un negocio sigue
-- suspendido, sus usuarios siguen baneados y hay que quitarlo a mano
-- (UPDATE auth.users SET banned_until = NULL WHERE id IN (...)).

DROP TRIGGER IF EXISTS trg_sincronizar_bloqueo_login_negocio ON negocios;
DROP FUNCTION IF EXISTS sincronizar_bloqueo_login_negocio();
