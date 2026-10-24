-- 003_triggers.up.sql
-- Triggers: order_status_history auto-log, updated_at auto-set

-- 1. Function: auto-update updated_at column
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply updated_at trigger to tables that have the column
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_carts_updated_at
    BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_delivery_tariffs_updated_at
    BEFORE UPDATE ON delivery_tariffs
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- 2. Function: auto-log order status changes to history
CREATE OR REPLACE FUNCTION trg_log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id BIGINT;
BEGIN
    -- Only log when status_id actually changes
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        -- Try to get current user from session context (set by app via SET LOCAL)
        v_user_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::BIGINT;

        INSERT INTO order_status_history (order_id, status_id, changed_by_user_id, comment)
        VALUES (NEW.id, NEW.status_id, v_user_id, NULL);
    END IF;
    RETURN NEW;
END;
$$;

-- Apply status history trigger on orders
CREATE TRIGGER trg_order_status_history
    AFTER UPDATE ON orders
    FOR EACH ROW
    WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
    EXECUTE FUNCTION trg_log_order_status_change();

-- 3. Helper function to set current user for trigger context
CREATE OR REPLACE FUNCTION set_current_user_id(p_user_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::TEXT, TRUE);
END;
$$;

COMMENT ON FUNCTION trg_set_updated_at IS 'Автоматически проставляет updated_at = NOW()';
COMMENT ON FUNCTION trg_log_order_status_change IS 'Записывает изменение статуса заказа в order_status_history';
COMMENT ON FUNCTION set_current_user_id IS 'Устанавливает ID текущего пользователя для контекста триггера';