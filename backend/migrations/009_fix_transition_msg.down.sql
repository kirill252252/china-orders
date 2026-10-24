-- 009_fix_transition_msg.down.sql
-- Rollback: restore original status transition validation function

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

COMMENT ON FUNCTION trg_validate_status_transition IS 'Проверяет, что переход статуса заказа допустим согласно order_status_transitions';