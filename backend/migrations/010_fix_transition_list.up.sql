-- 010_fix_transition_list.up.sql
-- Fix error message format in status transition validation trigger

CREATE OR REPLACE FUNCTION trg_validate_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_from_code VARCHAR(50);
    v_to_code VARCHAR(50);
    v_allowed TEXT;
BEGIN
    -- Only validate when status_id actually changes
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        -- Check if transition is allowed
        IF NOT EXISTS (
            SELECT 1 FROM order_status_transitions
            WHERE from_status_id = OLD.status_id
              AND to_status_id = NEW.status_id
        ) THEN
            -- Get status codes
            v_from_code := (SELECT code FROM order_statuses WHERE id = OLD.status_id);
            v_to_code := (SELECT code FROM order_statuses WHERE id = NEW.status_id);

            -- Get allowed transitions from current status
            SELECT string_agg(s.code, ', ')
            INTO v_allowed
            FROM order_status_transitions t
            JOIN order_statuses s ON s.id = t.to_status_id
            WHERE t.from_status_id = OLD.status_id;

            -- Build message
            IF v_allowed IS NULL OR v_allowed = '' THEN
                RAISE EXCEPTION 'Недопустимый переход статуса: % -> %. Разрешено из %: нет (конечный статус)',
                    v_from_code, v_to_code, v_from_code
                USING ERRCODE = 'check_violation';
            ELSE
                RAISE EXCEPTION 'Недопустимый переход статуса: % -> %. Разрешено из %: %',
                    v_from_code, v_to_code, v_from_code, v_allowed
                USING ERRCODE = 'check_violation';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_validate_status_transition IS 'Проверяет, что переход статуса заказа допустим согласно order_status_transitions';