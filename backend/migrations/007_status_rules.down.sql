-- 007_status_rules.down.sql
-- Rollback: remove status transition rules and triggers

-- Drop triggers
DROP TRIGGER IF EXISTS trg_log_initial_status ON orders;
DROP TRIGGER IF EXISTS trg_validate_status_transition ON orders;

-- Drop functions
DROP FUNCTION IF EXISTS trg_log_initial_status();
DROP FUNCTION IF EXISTS trg_validate_status_transition();

-- Drop table
DROP TABLE IF EXISTS order_status_transitions;