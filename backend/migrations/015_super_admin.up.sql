-- Главный администратор: единственный пользователь, который управляет администраторами
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Не больше одного главного администратора
CREATE UNIQUE INDEX ux_users_single_super_admin ON users (is_super_admin) WHERE is_super_admin;

-- Главный администратор не может быть заблокирован
ALTER TABLE users ADD CONSTRAINT chk_super_admin_active CHECK (NOT is_super_admin OR is_active);

-- Главным становится самый ранний администратор
UPDATE users SET is_super_admin = TRUE
WHERE id = (
    SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'admin' ORDER BY u.id LIMIT 1
);

COMMENT ON COLUMN users.is_super_admin IS 'Главный администратор (единственный), управляет ролью admin';