-- 005_views.down.sql
-- Rollback: drop views

DROP VIEW IF EXISTS v_customer_orders;
DROP VIEW IF EXISTS v_orders_summary;
DROP VIEW IF EXISTS v_manager_queue;