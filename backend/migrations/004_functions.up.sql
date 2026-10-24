-- 004_functions.up.sql
-- PL/pgSQL functions: order total calculation, current exchange rate

-- 1. Get current active CNY->RUB exchange rate
CREATE OR REPLACE FUNCTION fn_get_current_exchange_rate()
RETURNS NUMERIC(12,6)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_rate NUMERIC(12,6);
BEGIN
    SELECT rate INTO v_rate
    FROM exchange_rates
    WHERE base_currency = 'CNY'
      AND target_currency = 'RUB'
      AND is_active = TRUE
      AND valid_from <= NOW()
      AND (valid_until IS NULL OR valid_until > NOW())
    ORDER BY valid_from DESC
    LIMIT 1;

    IF v_rate IS NULL THEN
        RAISE EXCEPTION 'No active CNY->RUB exchange rate found';
    END IF;

    RETURN v_rate;
END;
$$;

-- 2. Find matching delivery tariff by weight
CREATE OR REPLACE FUNCTION fn_find_delivery_tariff(p_weight_kg NUMERIC(10,3))
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_tariff_id INT;
BEGIN
    SELECT id INTO v_tariff_id
    FROM delivery_tariffs
    WHERE is_active = TRUE
      AND min_weight_kg <= p_weight_kg
      AND (max_weight_kg IS NULL OR max_weight_kg >= p_weight_kg)
    ORDER BY min_weight_kg DESC
    LIMIT 1;

    RETURN v_tariff_id;
END;
$$;

-- 3. Calculate delivery cost by tariff and weight
CREATE OR REPLACE FUNCTION fn_calculate_delivery_cost(p_tariff_id INT, p_weight_kg NUMERIC(10,3))
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_cost NUMERIC(12,2);
    v_tariff RECORD;
BEGIN
    IF p_tariff_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT base_cost_rub, per_kg_cost_rub INTO v_tariff
    FROM delivery_tariffs
    WHERE id = p_tariff_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    v_cost := v_tariff.base_cost_rub + (p_weight_kg * v_tariff.per_kg_cost_rub);
    RETURN v_cost;
END;
$$;

-- 4. Calculate order total (main function)
-- Returns: total_rub, also updates order snapshot fields
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

-- 5. Recalculate order total using CURRENT rates/tariffs (for admin "what-if")
CREATE OR REPLACE FUNCTION fn_recalculate_order_current(p_order_id BIGINT)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_subtotal_cny NUMERIC(14,2);
    v_total_weight_kg NUMERIC(10,3);
    v_exchange_rate NUMERIC(12,6);
    v_commission NUMERIC(5,2) := 5; -- default
    v_tariff_id INT;
    v_delivery_cost NUMERIC(12,2);
    v_total_rub NUMERIC(12,2);
BEGIN
    -- Get current items
    SELECT COALESCE(SUM(oi.quantity * oi.price_cny), 0),
           COALESCE(SUM(oi.quantity * oi.weight_kg), 0)
    INTO v_subtotal_cny, v_total_weight_kg
    FROM order_items oi
    WHERE oi.order_id = p_order_id;

    -- Current rate
    v_exchange_rate := fn_get_current_exchange_rate();

    -- Current tariff
    v_tariff_id := fn_find_delivery_tariff(v_total_weight_kg);
    v_delivery_cost := fn_calculate_delivery_cost(v_tariff_id, v_total_weight_kg);

    -- Total
    v_total_rub := (v_subtotal_cny * v_exchange_rate * (1 + v_commission / 100)) + v_delivery_cost;

    RETURN v_total_rub;
END;
$$;

COMMENT ON FUNCTION fn_get_current_exchange_rate IS 'Возвращает текущий активный курс CNY->RUB';
COMMENT ON FUNCTION fn_find_delivery_tariff IS 'Находит подходящий тариф доставки по весу';
COMMENT ON FUNCTION fn_calculate_delivery_cost IS 'Рассчитывает стоимость доставки по тарифу и весу';
COMMENT ON FUNCTION fn_calculate_order_total IS 'Полный расчёт итоговой суммы заказа с обновлением снимков';
COMMENT ON FUNCTION fn_recalculate_order_current IS 'Пересчёт по текущим курсам/тарифам (для админки)';