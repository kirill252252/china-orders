-- 011_addresses_unique.down.sql
-- Rollback: remove unique index on addresses

DROP INDEX IF EXISTS ux_addresses_user_type_location;