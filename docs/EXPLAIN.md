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
                                                                                      QUERY PLAN                                                                                       
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Sort  (cost=5252.14..5252.36 rows=90 width=290) (actual time=10.002..12.143 rows=6 loops=1)
   Sort Key: (sum(((oi.quantity)::numeric * oi.price_cny))) DESC
   Sort Method: quicksort  Memory: 25kB
   Buffers: shared hit=2461
   ->  GroupAggregate  (cost=5203.14..5249.21 rows=90 width=290) (actual time=9.877..12.134 rows=6 loops=1)
         Group Key: m.name
         Buffers: shared hit=2461
         ->  Gather Merge  (cost=5203.14..5242.46 rows=345 width=245) (actual time=9.846..12.028 rows=366 loops=1)
               Workers Planned: 1
               Workers Launched: 1
               Buffers: shared hit=2461
               ->  Sort  (cost=4203.13..4203.64 rows=203 width=245) (actual time=7.515..7.522 rows=183 loops=2)
                     Sort Key: m.name, o.id
                     Sort Method: quicksort  Memory: 39kB
                     Buffers: shared hit=2461
                     Worker 0:  Sort Method: quicksort  Memory: 33kB
                     ->  Hash Join  (cost=12.60..4195.35 rows=203 width=245) (actual time=0.264..7.401 rows=183 loops=2)
                           Hash Cond: (p.marketplace_id = m.id)
                           Buffers: shared hit=2445
                           ->  Nested Loop  (cost=0.57..4182.77 rows=203 width=31) (actual time=0.157..7.258 rows=183 loops=2)
                                 Buffers: shared hit=2414
                                 ->  Nested Loop  (cost=0.42..4171.98 rows=203 width=35) (actual time=0.144..7.159 rows=183 loops=2)
                                       Buffers: shared hit=2271
                                       ->  Parallel Seq Scan on orders o  (cost=0.00..3156.00 rows=68 width=17) (actual time=0.120..6.649 rows=61 loops=2)
                                             Filter: ((status_id <> 9) AND (created_at >= (now() - '2 days'::interval)) AND (created_at < (now() - '1 day'::interval)))
                                             Rows Removed by Filter: 49950
                                             Buffers: shared hit=1538
                                       ->  Index Scan using idx_order_items_order_id on order_items oi  (cost=0.42..14.91 rows=3 width=26) (actual time=0.005..0.008 rows=3 loops=122)
                                             Index Cond: (order_id = o.id)
                                             Buffers: shared hit=733
                                 ->  Memoize  (cost=0.15..0.17 rows=1 width=12) (actual time=0.000..0.000 rows=1 loops=366)
                                       Cache Key: oi.product_id
                                       Cache Mode: logical
                                       Hits: 198  Misses: 36  Evictions: 0  Overflows: 0  Memory Usage: 5kB
                                       Buffers: shared hit=143
                                       Worker 0:  Hits: 97  Misses: 35  Evictions: 0  Overflows: 0  Memory Usage: 4kB
                                       ->  Index Scan using products_pkey on products p  (cost=0.14..0.16 rows=1 width=12) (actual time=0.001..0.001 rows=1 loops=71)
                                             Index Cond: (id = oi.product_id)
                                             Buffers: shared hit=143
                           ->  Hash  (cost=10.90..10.90 rows=90 width=222) (actual time=0.020..0.020 rows=6 loops=2)
                                 Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                 Buffers: shared hit=2
                                 ->  Seq Scan on marketplaces m  (cost=0.00..10.90 rows=90 width=222) (actual time=0.009..0.009 rows=6 loops=2)
                                       Buffers: shared hit=2
 Planning:
   Buffers: shared hit=18
 Planning Time: 0.327 ms
 Execution Time: 12.269 ms
(48 rows)
```

### План после индекса

```
                                                                                   QUERY PLAN                                                                                    
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Sort  (cost=2089.86..2090.08 rows=90 width=290) (actual time=0.995..0.996 rows=6 loops=1)
   Sort Key: (sum(((oi.quantity)::numeric * oi.price_cny))) DESC
   Sort Method: quicksort  Memory: 25kB
   Buffers: shared hit=936
   ->  GroupAggregate  (cost=2079.58..2086.93 rows=90 width=290) (actual time=0.903..0.988 rows=6 loops=1)
         Group Key: m.name
         Buffers: shared hit=936
         ->  Sort  (cost=2079.58..2080.41 rows=330 width=245) (actual time=0.882..0.893 rows=366 loops=1)
               Sort Key: m.name, o.id
               Sort Method: quicksort  Memory: 48kB
               Buffers: shared hit=936
               ->  Hash Join  (cost=18.18..2065.78 rows=330 width=245) (actual time=0.061..0.729 rows=366 loops=1)
                     Hash Cond: (p.marketplace_id = m.id)
                     Buffers: shared hit=936
                     ->  Nested Loop  (cost=6.15..2052.84 rows=330 width=31) (actual time=0.043..0.669 rows=366 loops=1)
                           Buffers: shared hit=935
                           ->  Nested Loop  (cost=6.00..2038.91 rows=330 width=35) (actual time=0.035..0.551 rows=366 loops=1)
                                 Buffers: shared hit=863
                                 ->  Bitmap Heap Scan on orders o  (cost=5.58..391.20 rows=110 width=17) (actual time=0.025..0.115 rows=122 loops=1)
                                       Recheck Cond: ((created_at >= (now() - '2 days'::interval)) AND (created_at < (now() - '1 day'::interval)))
                                       Filter: (status_id <> 9)
                                       Rows Removed by Filter: 11
                                       Heap Blocks: exact=129
                                       Buffers: shared hit=131
                                       ->  Bitmap Index Scan on idx_orders_created_at  (cost=0.00..5.55 rows=125 width=0) (actual time=0.015..0.015 rows=133 loops=1)
                                             Index Cond: ((created_at >= (now() - '2 days'::interval)) AND (created_at < (now() - '1 day'::interval)))
                                             Buffers: shared hit=2
                                 ->  Index Scan using idx_order_items_order_id on order_items oi  (cost=0.42..14.95 rows=3 width=26) (actual time=0.002..0.003 rows=3 loops=122)
                                       Index Cond: (order_id = o.id)
                                       Buffers: shared hit=732
                           ->  Memoize  (cost=0.15..0.17 rows=1 width=12) (actual time=0.000..0.000 rows=1 loops=366)
                                 Cache Key: oi.product_id
                                 Cache Mode: logical
                                 Hits: 330  Misses: 36  Evictions: 0  Overflows: 0  Memory Usage: 5kB
                                 Buffers: shared hit=72
                                 ->  Index Scan using products_pkey on products p  (cost=0.14..0.16 rows=1 width=12) (actual time=0.001..0.001 rows=1 loops=36)
                                       Index Cond: (id = oi.product_id)
                                       Buffers: shared hit=72
                     ->  Hash  (cost=10.90..10.90 rows=90 width=222) (actual time=0.009..0.010 rows=6 loops=1)
                           Buckets: 1024  Batches: 1  Memory Usage: 9kB
                           Buffers: shared hit=1
                           ->  Seq Scan on marketplaces m  (cost=0.00..10.90 rows=90 width=222) (actual time=0.002..0.003 rows=6 loops=1)
                                 Buffers: shared hit=1
 Planning:
   Buffers: shared hit=26
 Planning Time: 0.323 ms
 Execution Time: 1.118 ms
(47 rows)
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
                                                                             QUERY PLAN                                                                              
---------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Sort  (cost=1882.69..1882.73 rows=15 width=66) (actual time=2.647..2.648 rows=1 loops=1)
   Sort Key: o.total_rub DESC
   Sort Method: quicksort  Memory: 25kB
   Buffers: shared hit=1556
   ->  GroupAggregate  (cost=1881.99..1882.40 rows=15 width=66) (actual time=2.639..2.640 rows=1 loops=1)
         Group Key: o.id
         Buffers: shared hit=1556
         ->  Sort  (cost=1881.99..1882.02 rows=15 width=44) (actual time=2.634..2.635 rows=3 loops=1)
               Sort Key: o.id
               Sort Method: quicksort  Memory: 25kB
               Buffers: shared hit=1556
               ->  Nested Loop  (cost=166.37..1881.69 rows=15 width=44) (actual time=2.098..2.628 rows=3 loops=1)
                     Buffers: shared hit=1556
                     ->  Hash Join  (cost=165.94..1870.56 rows=5 width=26) (actual time=2.084..2.612 rows=1 loops=1)
                           Hash Cond: (o.user_id = u.id)
                           Buffers: shared hit=1550
                           ->  Bitmap Heap Scan on orders o  (cost=157.64..1833.29 rows=11012 width=34) (actual time=0.441..1.954 rows=11083 loops=1)
                                 Recheck Cond: (status_id = 8)
                                 Heap Blocks: exact=1536
                                 Buffers: shared hit=1547
                                 ->  Bitmap Index Scan on idx_orders_status_id  (cost=0.00..154.88 rows=11012 width=0) (actual time=0.319..0.319 rows=11083 loops=1)
                                       Index Cond: (status_id = 8)
                                       Buffers: shared hit=11
                           ->  Hash  (cost=8.29..8.29 rows=1 width=8) (actual time=0.017..0.018 rows=1 loops=1)
                                 Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                 Buffers: shared hit=3
                                 ->  Index Scan using users_email_key on users u  (cost=0.28..8.29 rows=1 width=8) (actual time=0.012..0.012 rows=1 loops=1)
                                       Index Cond: ((email)::text = 'gen777@demo.local'::text)
                                       Buffers: shared hit=3
                     ->  Index Scan using idx_order_items_order_id on order_items oi  (cost=0.42..2.20 rows=3 width=26) (actual time=0.013..0.014 rows=3 loops=1)
                           Index Cond: (order_id = o.id)
                           Buffers: shared hit=6
 Planning:
   Buffers: shared hit=26
 Planning Time: 0.263 ms
 Execution Time: 2.752 ms
(36 rows)
```

### План после индекса

```
                                                                            QUERY PLAN                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Sort  (cost=44.28..44.32 rows=15 width=65) (actual time=0.049..0.050 rows=1 loops=1)
   Sort Key: o.total_rub DESC
   Sort Method: quicksort  Memory: 25kB
   Buffers: shared hit=13
   ->  GroupAggregate  (cost=43.57..43.99 rows=15 width=65) (actual time=0.042..0.043 rows=1 loops=1)
         Group Key: o.id
         Buffers: shared hit=13
         ->  Sort  (cost=43.57..43.61 rows=15 width=43) (actual time=0.037..0.038 rows=3 loops=1)
               Sort Key: o.id
               Sort Method: quicksort  Memory: 25kB
               Buffers: shared hit=13
               ->  Nested Loop  (cost=5.17..43.28 rows=15 width=43) (actual time=0.029..0.031 rows=3 loops=1)
                     Buffers: shared hit=13
                     ->  Nested Loop  (cost=4.75..32.03 rows=5 width=25) (actual time=0.019..0.020 rows=1 loops=1)
                           Buffers: shared hit=7
                           ->  Index Scan using users_email_key on users u  (cost=0.28..8.29 rows=1 width=8) (actual time=0.014..0.014 rows=1 loops=1)
                                 Index Cond: ((email)::text = 'gen777@demo.local'::text)
                                 Buffers: shared hit=3
                           ->  Bitmap Heap Scan on orders o  (cost=4.47..23.69 rows=5 width=33) (actual time=0.004..0.004 rows=1 loops=1)
                                 Recheck Cond: ((u.id = user_id) AND (status_id = 8))
                                 Heap Blocks: exact=1
                                 Buffers: shared hit=4
                                 ->  Bitmap Index Scan on idx_orders_user_status_date  (cost=0.00..4.47 rows=5 width=0) (actual time=0.002..0.002 rows=1 loops=1)
                                       Index Cond: ((user_id = u.id) AND (status_id = 8))
                                       Buffers: shared hit=3
                     ->  Index Scan using idx_order_items_order_id on order_items oi  (cost=0.42..2.22 rows=3 width=26) (actual time=0.009..0.010 rows=3 loops=1)
                           Index Cond: (order_id = o.id)
                           Buffers: shared hit=6
 Planning:
   Buffers: shared hit=36
 Planning Time: 0.313 ms
 Execution Time: 0.120 ms
(32 rows)
```

**Вывод.** Условие состоит из равенства по `user_id` и равенства по `status_id`. Составной индекс начинается с этих двух столбцов, поэтому СУБД сразу попадает на нужные несколько строк. Без него приходится читать все заказы со статусом «выдан» (около 11 % таблицы) и затем фильтровать по клиенту. Составной индекс `(user_id, status_id, created_at)` также закрывает запросы «мои заказы» с сортировкой по дате, поэтому отдельный индекс по `user_id` не нужен и удалён миграцией 008.

## Итог

| Запрос | Индекс | До, мс | После, мс | Ускорение |
|---|---|---|---|---|
| А. Выручка по маркетплейсам за период | `idx_orders_created_at` | 12.269 | 1.118 | около 11× |
| Б. Заказы клиента по статусу | `idx_orders_user_status_date` | 2.752 | 0.120 | около 23× |

Абсолютное время зависит от оборудования и состояния кэша, поэтому основное значение имеет отношение «до/после» и изменение вида плана (замена Seq Scan на Index/Bitmap Scan).

