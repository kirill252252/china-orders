ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_super_admin_active;
DROP INDEX IF EXISTS ux_users_single_super_admin;
ALTER TABLE users DROP COLUMN IF EXISTS is_super_admin;