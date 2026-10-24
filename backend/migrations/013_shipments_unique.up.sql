-- 013_shipments_unique.up.sql
-- Replace idx_shipments_order_id with UNIQUE INDEX on shipments(order_id)

-- Drop old index
DROP INDEX IF EXISTS idx_shipments_order_id;

-- Create unique index on order_id (one shipment per order)
CREATE UNIQUE INDEX ux_shipments_order_id ON shipments(order_id);

COMMENT ON INDEX ux_shipments_order_id IS 'Одна отгрузка на заказ';