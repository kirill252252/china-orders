-- 006_fix_calc.down.sql
-- Rollback: restore old calculation function, drop settings table

-- 1. Restore original fn_calculate_order_total (before fix)
CREATE OR REPLACE FUNCTION fn_calculate_order_total(p_order_id BIGINT)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_subtotal_cny NUMERIC(14,2);
    v_total_weight_kg NUMERIC(10,3);
    v_exchange_rate NUMERIC(12,6);
    v_commission NUMERIC(5,2);
    v_tariff_id INT;
    v_delivery_cost NUMERIC(12,2);
    v_total_rub NUMERIC(12,2);
    v_order RECORD;
BEGIN
    -- Get order snapshot
    SELECT subtotal_cny, exchange_rate_used, commission_percent,
           exchange_rate_id, delivery_tariff_id
    INTO v_order
    FROM orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Calculate subtotal and total weight from order_items (fixed at order time)
    SELECT COALESCE(SUM(oi.quantity * oi.price_cny), 0),
           COALESCE(SUM(oi.quantity * oi.weight_kg), 0)
    INTO v_subtotal_cny, v_total_weight_kg
    FROM order_items oi
    WHERE oi.order_id = p_order_id;

    -- Use snapshot exchange rate if set, else current
    IF v_order.exchange_rate_used > 0 THEN
        v_exchange_rate := v_order.exchange_rate_used;
    ELSE
        v_exchange_rate := fn_get_current_exchange_rate();
    END IF;

    -- Use snapshot commission if set, else default 5%
    v_commission := COALESCE(v_order.commission_percent, 5);

    -- Determine delivery tariff
    IF v_order.delivery_tariff_id IS NOT NULL THEN
        v_tariff_id := v_order.delivery_tariff_id;
    ELSE
        v_tariff_id := fn_find_delivery_tariff(v_total_weight_kg);
    END IF;

    -- Calculate delivery cost
    v_delivery_cost := fn_calculate_delivery_cost(v_tariff_id, v_total_weight_kg);

    -- Total formula: subtotal_cny * rate * (1 + commission/100) + delivery_cost_rub
    v_total_rub := (v_subtotal_cny * v_exchange_rate * (1 + v_commission / 100)) + v_delivery_cost;

    -- Update order with calculated values (snapshot for history)
    UPDATE orders
    SET subtotal_cny = v_subtotal_cny,
        exchange_rate_used = COALESCE(v_order.exchange_rate_used, v_exchange_rate),
        commission_percent = COALESCE(v_order.commission_percent, v_commission),
        delivery_cost_rub = v_delivery_cost,
        total_rub = v_total_rub,
        delivery_tariff_id = COALESCE(v_order.delivery_tariff_id, v_tariff_id),
        exchange_rate_id = COALESCE(v_order.exchange_rate_id,
            (SELECT id FROM exchange_rates WHERE base_currency='CNY' AND target_currency='RUB' AND is_active AND valid_from <= NOW() ORDER BY valid_from DESC LIMIT 1)
        ),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN v_total_rub;
END;
$$;

-- 2. Drop settings table
DROP TABLE IF EXISTS settings;

COMMENT ON FUNCTION fn_calculate_order_total IS 'Полный расчёт итоговой суммы заказа с обновлением снимков (старая версия)';