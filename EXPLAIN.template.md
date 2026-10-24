# Анализ производительности запросов (EXPLAIN ANALYZE)

## Методика

Скрипт `backend/scripts/explain-demo.sql` выполняется в одной транзакции и заканчивается `ROLLBACK`, поэтому данные и изменения индексов в базе не остаются.

1. Генерация нагрузочных данных: 2000 клиентов, 100 000 заказов (статусы 1–9, даты за 2 года), 300 000 позиций заказов. Пользовательские триггеры на время генерации отключаются.
2. Для каждого запроса замер выполняется дважды: первый прогон прогревает кэш, показан второй (`EXPLAIN (ANALYZE, BUFFERS)`).
3. Состояние «до»: нужный индекс удалён. Состояние «после»: индекс создан и выполнен `ANALYZE`.

## Запрос А: выручка по маркетплейсам за сутки

Соединение 4 таблиц (`orders`, `order_items`, `products`, `marketplaces`), агрегаты и группировка по маркетплейсу, фильтр по диапазону дат.

```sql
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
```

Индекс: `idx_orders_created_at ON orders(created_at)`.

| Состояние | Время выполнения |
|---|---|
| До индекса | 12.269 мс |
| После индекса | 1.118 мс |

Ускорение примерно в 11 раз.

### План до индекса

```
{{A_BEFORE}}
```

### План после индекса

```
{{A_AFTER}}
```

**Вывод.** Фильтр по диапазону дат выбирает около 0,1 % заказов. Без индекса по `created_at` СУБД читает всю таблицу `orders`. С индексом читаются только строки из нужного диапазона, и дальше позиции заказов находятся по индексу `idx_order_items_order_id`. Индекс по дате эффективен для отчётов за период, которые нужны в админской статистике.

## Запрос Б: заказы одного клиента со статусом «выдан»

Соединение 3 таблиц (`users`, `orders`, `order_items`), группировка по заказу и агрегаты по позициям.

```sql
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
```

Индекс: `idx_orders_user_status_date ON orders(user_id, status_id, created_at)`.

| Состояние | Время выполнения |
|---|---|
| До индекса | 2.752 мс |
| После индекса | 0.120 мс |

Ускорение примерно в 23 раза.

### План до индекса

```
{{B_BEFORE}}
```

### План после индекса

```
{{B_AFTER}}
```

**Вывод.** Условие состоит из равенства по `user_id` и равенства по `status_id`. Составной индекс начинается с этих двух столбцов, поэтому СУБД сразу попадает на нужные несколько строк. Без него приходится читать все заказы со статусом «выдан» (около 11 % таблицы) и затем фильтровать по клиенту. Составной индекс `(user_id, status_id, created_at)` также закрывает запросы «мои заказы» с сортировкой по дате, поэтому отдельный индекс по `user_id` не нужен и удалён миграцией 008.

## Итог

| Запрос | Индекс | До, мс | После, мс | Ускорение |
|---|---|---|---|---|
| А. Выручка по маркетплейсам за период | `idx_orders_created_at` | 12.269 | 1.118 | около 11× |
| Б. Заказы клиента по статусу | `idx_orders_user_status_date` | 2.752 | 0.120 | около 23× |

Абсолютное время зависит от оборудования и состояния кэша, поэтому основное значение имеет отношение «до/после» и изменение вида плана (замена Seq Scan на Index/Bitmap Scan).
