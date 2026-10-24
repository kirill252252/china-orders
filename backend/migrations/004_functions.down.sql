-- 004_functions.down.sql
-- Rollback: drop PL/pgSQL functions

DROP FUNCTION IF EXISTS fn_recalculate_order_current(BIGINT);
DROP FUNCTION IF EXISTS fn_calculate_order_total(BIGINT);
DROP FUNCTION IF EXISTS fn_calculate_delivery_cost(INT, NUMERIC(10,3));
DROP FUNCTION IF EXISTS fn_find_delivery_tariff(NUMERIC(10,3));
DROP FUNCTION IF EXISTS fn_get_current_exchange_rate();