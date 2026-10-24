-- 008_indexes.down.sql
-- Rollback: restore removed indexes, drop added indexes

-- Drop added indexes
DROP INDEX IF EXISTS idx_order_items_product_id;
DROP INDEX IF EXISTS idx_cart_items_product_id;
DROP INDEX IF EXISTS idx_order_status_history_status_id;
DROP INDEX IF EXISTS idx_orders_delivery_tariff_id;
DROP INDEX IF EXISTS idx_orders_shipping_address_id;

-- Restore removed indexes (if they were actually needed)
-- Note: these were dropped as duplicates, but if needed they can be recreated
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);