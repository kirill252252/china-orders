-- 008_indexes.up.sql
-- Add missing FK indexes, remove duplicate indexes

-- 1. Remove duplicate indexes (per audit)
DROP INDEX IF EXISTS idx_cart_items_cart_id;  -- duplicate: FK already has index or not needed
DROP INDEX IF EXISTS idx_orders_user_id;    -- duplicate: FK already has index or not needed

-- 2. Add missing FK indexes

-- order_items(product_id) -> products
-- For: JOIN order_items oi ON oi.product_id = p.id (product lookups in cart/order)
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- cart_items(product_id) -> products
-- For: JOIN cart_items ci ON ci.product_id = p.id (product lookups in cart)
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- order_status_history(status_id) -> order_statuses
-- For: SELECT * FROM order_status_history WHERE status_id = ? (filter history by status)
CREATE INDEX idx_order_status_history_status_id ON order_status_history(status_id);

-- orders(delivery_tariff_id) -> delivery_tariffs
-- For: JOIN orders o ON o.delivery_tariff_id = dt.id (tariff lookups in order calc)
CREATE INDEX idx_orders_delivery_tariff_id ON orders(delivery_tariff_id);

-- orders(shipping_address_id) -> addresses
-- For: JOIN orders o ON o.shipping_address_id = a.id (address lookups in order)
CREATE INDEX idx_orders_shipping_address_id ON orders(shipping_address_id);

COMMENT ON INDEX idx_order_items_product_id IS 'Для JOIN order_items -> products (product lookups)';
COMMENT ON INDEX idx_cart_items_product_id IS 'Для JOIN cart_items -> products (product lookups)';
COMMENT ON INDEX idx_order_status_history_status_id IS 'Для фильтра истории по статусу';
COMMENT ON INDEX idx_orders_delivery_tariff_id IS 'Для JOIN orders -> delivery_tariffs (расчёт доставки)';
COMMENT ON INDEX idx_orders_shipping_address_id IS 'Для JOIN orders -> addresses (адрес доставки)';