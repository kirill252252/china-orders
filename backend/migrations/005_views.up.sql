-- 005_views.up.sql
-- Views for manager queue, orders summary, customer orders

-- 1. Manager queue: orders awaiting action
CREATE OR REPLACE VIEW v_manager_queue AS
SELECT
    o.id AS order_id,
    o.order_number,
    u.full_name AS customer_name,
    u.phone AS customer_phone,
    u.email AS customer_email,
    os.code AS status_code,
    os.name_ru AS status_name,
    os.sort_order AS status_sort_order,
    o.total_rub,
    o.created_at,
    o.updated_at,
    o.manager_comment,
    COUNT(oi.id) AS items_count,
    COALESCE(SUM(oi.quantity * oi.weight_kg), 0) AS total_weight_kg
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_statuses os ON o.status_id = os.id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.status_id IN (
    SELECT id FROM order_statuses
    WHERE code IN ('awaiting_payment', 'paid', 'purchased')
)
GROUP BY o.id, u.full_name, u.phone, u.email, os.code, os.name_ru, os.sort_order, o.total_rub, o.created_at, o.updated_at, o.manager_comment
ORDER BY os.sort_order, o.created_at;

COMMENT ON VIEW v_manager_queue IS 'Очередь менеджера: заказы в статусах awaiting_payment, paid, purchased';

-- 2. Orders summary for admin dashboard
CREATE OR REPLACE VIEW v_orders_summary AS
SELECT
    os.code AS status_code,
    os.name_ru AS status_name,
    os.sort_order AS status_sort_order,
    COUNT(o.id) AS orders_count,
    COALESCE(SUM(o.total_rub), 0) AS total_revenue_rub,
    CASE WHEN COUNT(o.id) > 0 THEN ROUND(AVG(o.total_rub)::NUMERIC, 2) ELSE 0 END AS avg_order_rub,
    ROUND(AVG(EXTRACT(EPOCH FROM (o.paid_at - o.created_at))/3600/24)::NUMERIC, 2) AS avg_days_created_to_paid,
    ROUND(AVG(EXTRACT(EPOCH FROM (o.completed_at - o.paid_at))/3600/24)::NUMERIC, 2) AS avg_days_paid_to_delivered
FROM orders o
JOIN order_statuses os ON o.status_id = os.id
GROUP BY os.code, os.name_ru, os.sort_order
ORDER BY os.sort_order;

COMMENT ON VIEW v_orders_summary IS 'Сводка заказов по статусам для админки';

-- 3. Customer orders with latest status
CREATE OR REPLACE VIEW v_customer_orders AS
SELECT
    o.id AS order_id,
    o.order_number,
    o.user_id,
    os.code AS status_code,
    os.name_ru AS status_name,
    o.total_rub,
    o.created_at,
    o.updated_at,
    o.paid_at,
    o.completed_at,
    o.cancelled_at,
    (
        SELECT MAX(osh.created_at)
        FROM order_status_history osh
        WHERE osh.order_id = o.id
    ) AS latest_status_at,
    (
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = o.id
    ) AS items_count
FROM orders o
JOIN order_statuses os ON o.status_id = os.id;

COMMENT ON VIEW v_customer_orders IS 'Заказы клиента с последними статусами для личного кабинета';