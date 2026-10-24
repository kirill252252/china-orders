-- 011_addresses_unique.up.sql
-- Add unique constraint on addresses to prevent duplicates

-- 1. Deduplicate existing addresses before creating index
-- Keep the row with minimum id, redirect FK references, merge is_default

-- Create temp table to map duplicate groups
CREATE TEMP TABLE tmp_addr_groups AS
SELECT 
    user_id, type, country, city, street, building, 
    COALESCE(apartment, '') AS apartment_key,
    COALESCE(postal_code, '') AS postal_code_key,
    MIN(id) AS keep_id,
    BOOL_OR(is_default) AS any_default
FROM addresses
GROUP BY user_id, type, country, city, street, building, COALESCE(apartment, ''), COALESCE(postal_code, '')
HAVING COUNT(*) > 1;

-- Update is_default on kept rows
UPDATE addresses a
SET is_default = t.any_default
FROM tmp_addr_groups t
WHERE a.id = t.keep_id AND t.any_default;

-- Redirect FK references from orders.shipping_address_id
UPDATE orders
SET shipping_address_id = t.keep_id
FROM tmp_addr_groups t
WHERE orders.shipping_address_id IN (
    SELECT a2.id FROM addresses a2
    WHERE (a2.user_id, a2.type, a2.country, a2.city, a2.street, a2.building, COALESCE(a2.apartment, ''), COALESCE(a2.postal_code, '')) IN (
        SELECT user_id, type, country, city, street, building, apartment_key, postal_code_key FROM tmp_addr_groups
    )
    AND a2.id != t.keep_id
);

-- Delete duplicate rows (keep only the one with min id)
DELETE FROM addresses
WHERE id IN (
    SELECT a.id FROM addresses a
    JOIN tmp_addr_groups t ON 
        a.user_id = t.user_id AND 
        a.type = t.type AND 
        a.country = t.country AND 
        a.city = t.city AND 
        a.street = t.street AND 
        a.building = t.building AND 
        COALESCE(a.apartment, '') = t.apartment_key AND 
        COALESCE(a.postal_code, '') = t.postal_code_key
    WHERE a.id != t.keep_id
);

DROP TABLE tmp_addr_groups;

-- 2. Create unique index based on Postgres version
DO $$
DECLARE
    v_version TEXT;
    v_major INT;
BEGIN
    SELECT version() INTO v_version;
    -- Extract major version number (e.g., "16.15" -> 16)
    v_major := split_part(split_part(v_version, ' ', 2), '.', 1)::INT;
    
    IF v_major >= 15 THEN
        EXECUTE 'CREATE UNIQUE INDEX ux_addresses_user_type_location 
                 ON addresses (user_id, type, country, city, street, building, apartment, postal_code)
                 NULLS NOT DISTINCT';
    ELSE
        EXECUTE 'CREATE UNIQUE INDEX ux_addresses_user_type_location 
                 ON addresses (user_id, type, country, city, street, building, 
                               COALESCE(apartment, ''"), COALESCE(postal_code, ''"))';
    END IF;
END;
$$;

COMMENT ON INDEX ux_addresses_user_type_location IS 'Предотвращает дубли адресов: user_id + type + location (NULL = NULL)';