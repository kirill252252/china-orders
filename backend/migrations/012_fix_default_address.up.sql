-- 012_fix_default_address.up.sql
-- Fix missing default addresses and add partial unique index

-- 1. For each user without a default address, set the first address (by id) as default
UPDATE addresses a
SET is_default = TRUE
WHERE a.id IN (
    SELECT MIN(a2.id)
    FROM addresses a2
    LEFT JOIN (
        SELECT user_id FROM addresses WHERE is_default = TRUE
    ) d ON a2.user_id = d.user_id
    WHERE d.user_id IS NULL
    GROUP BY a2.user_id
);

-- 2. Partial unique index: only one default address per user
CREATE UNIQUE INDEX ux_addresses_user_default
ON addresses (user_id)
WHERE is_default = TRUE;

COMMENT ON INDEX ux_addresses_user_default IS 'Один адрес по умолчанию на пользователя (partial unique index)';