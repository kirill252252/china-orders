-- 006_fix_calc.up.sql
-- Fix calculation function: handle zero defaults properly, add settings table

-- 1. Settings table for default values
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(255) NOT NULL
);

INSERT INTO settings (key, value) VALUES
('default_commission_percent', '5')
ON CONFLICT (key) DO NOTHING;

-- 2. Recalculate function with proper zero handling
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
    v_default_commission NUMERIC(5,2);
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

    -- Use snapshot exchange rate if set (>0), else current
    IF v_order.exchange_rate_used > 0 THEN
        v_exchange_rate := v_order.exchange_rate_used;
    ELSE
        v_exchange_rate := fn_get_current_exchange_rate();
    END IF;

    -- Use snapshot commission if set (>0), else settings default
    SELECT COALESCE(NULLIF(v_order.commission_percent, 0), value::NUMERIC)
    INTO v_default_commission
    FROM settings
    WHERE key = 'default_commission_percent';

    v_commission := v_default_commission;

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
        exchange_rate_used = v_exchange_rate,          -- always write actual rate used
        commission_percent = v_commission,             -- always write actual commission
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

COMMENT ON FUNCTION fn_calculate_order_total IS 'Полный расчёт итоговой суммы заказа с обновлением снимков (исправлено: нулевые дефолты обрабатываются через NULLIF и settings)';