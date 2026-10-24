-- 003_triggers.down.sql
-- Rollback: drop triggers and functions

DROP TRIGGER IF EXISTS trg_order_status_history ON orders;
DROP FUNCTION IF EXISTS trg_log_order_status_change();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS trg_shipments_updated_at ON shipments;
DROP TRIGGER IF EXISTS trg_delivery_tariffs_updated_at ON delivery_tariffs;
DROP FUNCTION IF EXISTS trg_set_updated_at();

DROP FUNCTION IF EXISTS set_current_user_id(BIGINT);