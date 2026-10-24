-- explain-demo.sql
-- Демонстрация влияния индексов на сложные запросы (для курсовой).
-- Весь скрипт идёт в одной транзакции и заканчивается ROLLBACK:
-- сгенерированные данные и изменения индексов в базе не остаются.
-- Каждый EXPLAIN выполняется дважды: первый прогрев кэша (вывод скрыт), второй показан.
-- Запуск: Get-Content backend\scripts\explain-demo.sql | docker compose -f docker-compose.dev.yml exec -T postgres psql -U app_user -d china_orders

\set ON_ERROR_STOP on
\timing off
BEGIN;

-- ============ 1. Генерация данных ============
-- На время генерации отключаем пользовательские триггеры (история статусов, валидация переходов)
ALTER TABLE orders DISABLE TRIGGER USER;
ALTER TABLE order_items DISABLE TRIGGER USER;

-- 2000 демо-клиентов, чтобы рейтинг «топ клиентов» был содержательным
INSERT INTO users (email, password_hash, full_name, role_id)
SELECT 'gen' || g || '@demo.local', 'demo-hash', 'Demo Client ' || g,
       (SELECT id FROM roles WHERE name = 'customer')
FROM generate_series(1, 2000) g;

-- 100000 заказов: случайный клиент, статус 1..9, дата за последние 2 года
INSERT INTO orders (order_number, user_id, status_id, subtotal_cny, exchange_rate_used,
                    commission_percent, delivery_cost_rub, total_rub, created_at)
SELECT 'GEN-' || g,
       u.ids[1 + floor(random() * u.n)::int],
       1 + floor(random() * 9)::int,
       sub, 12.5, 5, 500,
       round((sub * 12.5 * 1.05 + 500)::numeric, 2),
       NOW() - random() * interval '730 days'
FROM generate_series(1, 100000) g
CROSS JOIN (SELECT array_agg(id) AS ids, count(*) AS n FROM users WHERE email LIKE 'gen%@demo.local') u
CROSS JOIN LATERAL (SELECT round((50 + random() * 2000)::numeric, 2) AS sub) s;

-- 300000 позиций (по 3 на заказ) из существующих товаров
INSERT INTO order_items (order_id, product_id, quantity, price_cny, weight_kg)
SELECT o.id,
       p.ids[1 + floor(random() * p.n)::int],
       1 + floor(random() * 3)::int,
       round((20 + random() * 500)::numeric, 2),
       round((0.1 + random() * 3)::numeric, 3)
FROM orders o
CROSS JOIN generate_series(1, 3) k
CROSS JOIN (SELECT array_agg(id) AS ids, count(*) AS n FROM products) p
WHERE o.order_number LIKE 'GEN-%';

ALTER TABLE orders ENABLE TRIGGER USER;
ALTER TABLE order_items ENABLE TRIGGER USER;
ANALYZE users; ANALYZE orders; ANALYZE order_items;

SELECT (SELECT count(*) FROM orders) AS orders_total,
       (SELECT count(*) FROM order_items) AS items_total;

-- ============ 2. Запрос А: выручка по маркетплейсам за период ============
-- JOIN 4 таблиц + GROUP BY + агрегаты, фильтр по дате (одни сутки из 730)
-- Индекс: idx_orders_created_at (по диапазону дат)
\echo '=== QUERY A: BEFORE index ==='
DROP INDEX IF EXISTS idx_orders_created_at;
\o /dev/null
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.name AS marketplace,
       count(DISTINCT o.id) AS orders_count,
       sum(oi.quantity * oi.price_cny) AS revenue_cny,
       round(avg(o.total_rub), 2) AS avg_order_rub
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN marketplaces m ON m.id = p.marketplace_id
WHERE o.created_at >= NOW() - interval '2 days'
  AND o.created_at <  NOW() - interval '1 day'
  AND o.status_id <> 9
GROUP BY m.name
ORDER BY revenue_cny DESC;
\o
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.name AS marketplace,
       count(DISTINCT o.id) AS orders_count,
       sum(oi.quantity * oi.price_cny) AS revenue_cny,
       round(avg(o.total_rub), 2) AS avg_order_rub
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN marketplaces m ON m.id = p.marketplace_id
WHERE o.created_at >= NOW() - interval '2 days'
  AND o.created_at <  NOW() - interval '1 day'
  AND o.status_id <> 9
GROUP BY m.name
ORDER BY revenue_cny DESC;

\echo '=== QUERY A: AFTER index ==='
CREATE INDEX idx_orders_created_at ON orders(created_at);
ANALYZE orders;
\o /dev/null
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.name AS marketplace,
       count(DISTINCT o.id) AS orders_count,
       sum(oi.quantity * oi.price_cny) AS revenue_cny,
       round(avg(o.total_rub), 2) AS avg_order_rub
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN marketplaces m ON m.id = p.marketplace_id
WHERE o.created_at >= NOW() - interval '2 days'
  AND o.created_at <  NOW() - interval '1 day'
  AND o.status_id <> 9
GROUP BY m.name
ORDER BY revenue_cny DESC;
\o
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.name AS marketplace,
       count(DISTINCT o.id) AS orders_count,
       sum(oi.quantity * oi.price_cny) AS revenue_cny,
       round(avg(o.total_rub), 2) AS avg_order_rub
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN marketplaces m ON m.id = p.marketplace_id
WHERE o.created_at >= NOW() - interval '2 days'
  AND o.created_at <  NOW() - interval '1 day'
  AND o.status_id <> 9
GROUP BY m.name
ORDER BY revenue_cny DESC;

-- ============ 3. Запрос Б: заказы одного клиента с позициями ============
-- JOIN 3 таблиц + GROUP BY: сводка по заказам клиента за год
-- Индекс: idx_orders_user_status_date (user_id, status_id, created_at)
\echo '=== QUERY B: BEFORE index ==='
DROP INDEX IF EXISTS idx_orders_user_status_date;
DROP INDEX IF EXISTS idx_orders_user_id;
\o /dev/null
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.order_number, o.total_rub,
       count(oi.id) AS items_count,
       sum(oi.quantity * oi.weight_kg) AS total_weight_kg
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
WHERE u.email = 'gen777@demo.local'
  AND o.status_id = 8
GROUP BY o.id
ORDER BY o.total_rub DESC;
\o
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.order_number, o.total_rub,
       count(oi.id) AS items_count,
       sum(oi.quantity * oi.weight_kg) AS total_weight_kg
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
WHERE u.email = 'gen777@demo.local'
  AND o.status_id = 8
GROUP BY o.id
ORDER BY o.total_rub DESC;

\echo '=== QUERY B: AFTER index ==='
CREATE INDEX idx_orders_user_status_date ON orders(user_id, status_id, created_at);
ANALYZE orders;
\o /dev/null
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.order_number, o.total_rub,
       count(oi.id) AS items_count,
       sum(oi.quantity * oi.weight_kg) AS total_weight_kg
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
WHERE u.email = 'gen777@demo.local'
  AND o.status_id = 8
GROUP BY o.id
ORDER BY o.total_rub DESC;
\o
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.order_number, o.total_rub,
       count(oi.id) AS items_count,
       sum(oi.quantity * oi.weight_kg) AS total_weight_kg
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
WHERE u.email = 'gen777@demo.local'
  AND o.status_id = 8
GROUP BY o.id
ORDER BY o.total_rub DESC;

ROLLBACK;
\echo '=== ROLLBACK done, check ==='
SELECT (SELECT count(*) FROM orders) AS orders_after_rollback,
       (SELECT count(*) FROM order_items) AS items_after_rollback;
