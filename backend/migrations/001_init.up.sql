-- 001_init.up.sql
-- Initial migration: create schema_migrations tracking table

CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE schema_migrations IS 'Tracks applied SQL migrations';
COMMENT ON COLUMN schema_migrations.name IS 'Migration name (e.g. 001_init)';
COMMENT ON COLUMN schema_migrations.applied_at IS 'When the migration was applied';