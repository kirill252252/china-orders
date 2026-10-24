-- 013_shipments_unique.down.sql
-- Rollback: restore old index, drop unique constraint

DROP INDEX IF EXISTS ux_shipments_order_id;
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);