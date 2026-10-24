-- 012_fix_default_address.down.sql
-- Rollback: remove partial unique index

DROP INDEX IF EXISTS ux_addresses_user_default;