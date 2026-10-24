-- 007_status_rules.up.sql
-- Status transition rules and triggers

-- 1. Table of allowed status transitions
CREATE TABLE order_status_transitions (
    from_status_id INT NOT NULL REFERENCES order_statuses(id) ON DELETE RESTRICT,
    to_status_id   INT NOT NULL REFERENCES order_statuses(id) ON DELETE RESTRICT,
    PRIMARY KEY (from_status_id, to_status_id)
);

COMMENT ON TABLE order_status_transitions IS 'Допустимые переходы между статусами заказа';

-- 2. Populate allowed transitions
-- Chain: new → awaiting_payment → paid → purchased → shipped_from_china → in_transit → arrived_warehouse → delivered
-- cancelled allowed from: new, awaiting_payment, paid, purchased
INSERT INTO order_status_transitions (from_status_id, to_status_id)
SELECT s1.id, s2.id
FROM order_statuses s1
JOIN order_statuses s2 ON (
    -- Main chain
    (s1.code = 'new'                 AND s2.code = 'awaiting_payment') OR
    (s1.code = 'awaiting_payment'    AND s2.code = 'paid') OR
    (s1.code = 'paid'                AND s2.code = 'purchased') OR
    (s1.code = 'purchased'           AND s2.code = 'shipped_from_china') OR
    (s1.code = 'shipped_from_china'  AND s2.code = 'in_transit') OR
    (s1.code = 'in_transit'          AND s2.code = 'arrived_warehouse') OR
    (s1.code = 'arrived_warehouse'   AND s2.code = 'delivered') OR
    -- Cancelled branch
    (s1.code IN ('new', 'awaiting_payment', 'paid', 'purchased') AND s2.code = 'cancelled')
);

-- 3. Function: validate status transition
CREATE OR REPLACE FUNCTION trg_validate_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only validate when status_id actually changes
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        -- Check if transition is allowed
        IF NOT EXISTS (
            SELECT 1 FROM order_status_transitions
            WHERE from_status_id = OLD.status_id
              AND to_status_id = NEW.status_id
        ) THEN
            -- Get status names for error message
            RAISE EXCEPTION 'Недопустимый переход статуса: % -> %. Разрешённые переходы: %',
                (SELECT code FROM order_statuses WHERE id = OLD.status_id),
                (SELECT code FROM order_statuses WHERE id = NEW.status_id),
                (SELECT string_agg(t.code, ' → ') 
                 FROM order_status_transitions t
                 JOIN order_statuses s ON s.id = t.to_status_id
                 WHERE t.from_status_id = OLD.status_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 4. BEFORE UPDATE trigger: validate transition
CREATE TRIGGER trg_validate_status_transition
    BEFORE UPDATE ON orders
    FOR EACH ROW
    WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
    EXECUTE FUNCTION trg_validate_status_transition();

-- 5. Function: log initial status on INSERT
CREATE OR REPLACE FUNCTION trg_log_initial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id BIGINT;
BEGIN
    -- Try to get current user from session context
    v_user_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::BIGINT;

    INSERT INTO order_status_history (order_id, status_id, changed_by_user_id, comment)
    VALUES (NEW.id, NEW.status_id, v_user_id, 'Initial status on create');

    RETURN NEW;
END;
$$;

-- 6. AFTER INSERT trigger: log initial status
CREATE TRIGGER trg_log_initial_status
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION trg_log_initial_status();

COMMENT ON FUNCTION trg_validate_status_transition IS 'Проверяет, что переход статуса заказа допустим согласно order_status_transitions';
COMMENT ON FUNCTION trg_log_initial_status IS 'Записывает начальный статус заказа в историю при создании';