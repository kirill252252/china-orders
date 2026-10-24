# Описание базы данных (структура, нормализация, индексы)

> Заполняется в Фазе 2 после создания миграций. Здесь — плановое оглавление.

## 1. Таблицы и назначение

| Таблица | Назначение | Приблизительный объём (seed) |
|---------|------------|------------------------------|
| `roles` | Справочник ролей | 3 |
| `users` | Пользователи системы | 10+ |
| `addresses` | Адреса доставки/биллинга | 20+ |
| `marketplaces` | Поддерживаемые маркетплейсы | 6 |
| `products` | Товары (импортированные/ручные) | 30+ |
| `carts` | Корзины пользователей (1 на юзера) | = users |
| `cart_items` | Позиции в корзинах | 50+ |
| `orders` | Заказы | 20+ |
| `order_items` | Позиции заказов | 50+ |
| `order_statuses` | Справочник статусов заказа | 9 |
| `order_status_history` | **Аудит** смен статусов | 100+ |
| `payments` | Платёжные попытки | 30+ |
| `shipments` | Отправления/логистика | 15+ |
| `exchange_rates` | История курсов валют | 10+ |
| `delivery_tariffs` | Тарифы доставки по весу | 5+ |

## 2. Нормализация (3НФ)

Каждая таблица удовлетворяет 3НФ:
- **1НФ**: Атомарные значения, нет повторяющихся групп
- **2НФ**: Нет частичных зависимостей от составного ключа (все PK — суррогатные `id`)
- **3НФ**: Нет транзитивных зависимостей (неключевые атрибуты зависят только от PK)

Примеры:
- `users.role_id → roles.id` (не храним `role_name` в users)
- `products.marketplace_id → marketplaces.id` (не дублируем `marketplace_name`)
- `orders.status_id → order_statuses.id` (статус — справочник)
- `order_items.price_cny` — зафиксирована на момент заказа (не ссылка на текущую цену продукта)

## 3. Ключи и ограничения

### Primary Keys
Все таблицы: `id BIGSERIAL PRIMARY KEY` (кроме справочников — `INT`)

### Foreign Keys
| Child | Parent | On Delete | Комментарий |
|-------|--------|-----------|-------------|
| users.role_id | roles.id | RESTRICT | Нельзя удалить роль, если есть пользователи |
| addresses.user_id | users.id | CASCADE | Удаление юзера удаляет адреса |
| products.marketplace_id | marketplaces.id | RESTRICT | |
| carts.user_id | users.id | CASCADE | Одна корзина на юзера |
| cart_items.cart_id | carts.id | CASCADE | |
| cart_items.product_id | products.id | RESTRICT | Товар не удаляем, если в корзине |
| orders.user_id | users.id | RESTRICT | История заказов сохраняется |
| orders.status_id | order_statuses.id | RESTRICT | |
| orders.exchange_rate_id | exchange_rates.id | RESTRICT | Снимок курса на момент заказа |
| orders.delivery_tariff_id | delivery_tariffs.id | RESTRICT | Снимок тарифа на момент заказа |
| orders.shipping_address_id | addresses.id | SET NULL | Адрес может быть удалён отдельно |
| order_items.order_id | orders.id | CASCADE | |
| order_items.product_id | products.id | RESTRICT | |
| order_status_history.order_id | orders.id | CASCADE | |
| order_status_history.status_id | order_statuses.id | RESTRICT | |
| order_status_history.changed_by_user_id | users.id | SET NULL | |
| payments.order_id | orders.id | CASCADE | |
| shipments.order_id | orders.id | CASCADE | |

### Unique Constraints
- `users.email` — уникальный логин
- `roles.name` — customer/manager/admin
- `marketplaces.code` — taobao/tmall/1688/...
- `products(marketplace_id, external_id)` — товар уникален в рамках маркетплейса
- `carts.user_id` — одна корзина на пользователя
- `cart_items(cart_id, product_id, selected_attributes)` — одна позиция на набор атрибутов
- `orders.order_number` — бизнес-идентификатор
- `exchange_rates(base_currency, target_currency, valid_from)` — история курсов

### Check Constraints
- `products.price_cny > 0`
- `products.weight_kg >= 0`
- `cart_items.quantity > 0`
- `order_items.quantity > 0`
- `order_items.price_cny >= 0`
- `exchange_rates.rate > 0`
- `delivery_tariffs.min_weight_kg >= 0`
- `delivery_tariffs.max_weight_kg IS NULL OR max_weight_kg > min_weight_kg`
- `order_statuses.sort_order >= 0`

## 4. Индексы (с обоснованием)

| Таблица | Индекс | Тип | Обоснование |
|---------|--------|-----|-------------|
| `users` | `idx_users_email` | UNIQUE | Быстрый поиск по email при логине |
| `users` | `idx_users_role_id` | BTREE | Фильтрация по роли (админка) |
| `addresses` | `idx_addresses_user_id` | BTREE | Адреса конкретного пользователя |
| `products` | `idx_products_marketplace_id` | BTREE | Фильтр каталога по маркетплейсу |
| `products` | `idx_products_is_active` | BTREE | Только активные товары в каталоге |
| `products` | `idx_products_price_cny` | BTREE | Сортировка по цене |
| `products` | `idx_products_search` | GIN (to_tsvector) | Полнотекстовый поиск по name/description |
| `carts` | `idx_carts_user_id` | UNIQUE | Уже PK по user_id, но явный для ясности |
| `cart_items` | `idx_cart_items_cart_id` | BTREE | Все позиции корзины |
| `orders` | `idx_orders_user_id` | BTREE | Заказы пользователя (личный кабинет) |
| `orders` | `idx_orders_status_id` | BTREE | Фильтр по статусу (менеджерская очередь) |
| `orders` | `idx_orders_created_at` | BTREE | Сортировка по дате, диапазоны дат |
| `orders` | `idx_orders_user_status_date` | BTREE (composite) | Составной: user + status + created_at для "мои заказы с фильтром" |
| `order_items` | `idx_order_items_order_id` | BTREE | Позиции заказа |
| `order_status_history` | `idx_osh_order_id` | BTREE | Таймлайн заказа |
| `order_status_history` | `idx_osh_created_at` | BTREE | Аналитика по времени смен статусов |
| `payments` | `idx_payments_order_id` | BTREE | Платежи заказа |
| `payments` | `idx_payments_status` | BTREE | Поиск неудачных/ожидающих |
| `shipments` | `idx_shipments_order_id` | BTREE | Отправления заказа |
| `shipments` | `idx_shipments_tracking` | BTREE | Поиск по трек-номеру |
| `exchange_rates` | `idx_exchange_rates_active` | BTREE (partial) | `WHERE is_active AND base_currency='CNY' AND target_currency='RUB'` — мгновенный current rate |
| `delivery_tariffs` | `idx_delivery_tariffs_active` | BTREE (partial) | `WHERE is_active` — активные тарифы для расчёта |

> Все индексы создаются в миграциях с комментариями `COMMENT ON INDEX ... IS '...'`.

## 5. Обоснование денормализации снимков заказа (Order Snapshots)

В таблице `orders` хранятся **копии значений** на момент оформления заказа:
- `exchange_rate_used` — `numeric(12,6)` — курс CNY→RUB
- `commission_percent` — `numeric(5,2)` — комиссия %
- `delivery_cost_rub` — `numeric(12,2)` — рассчитанная стоимость доставки
- `total_rub` — `numeric(12,2)` — итоговая сумма в рублях

**Параллельно** хранятся FK на справочники:
- `exchange_rate_id` → `exchange_rates.id`
- `delivery_tariff_id` → `delivery_tariffs.id`

### Зачем это нужно (почему не только FK):

| Причина | Объяснение |
|---------|------------|
| **Историческая точность** | Курсы и тарифы меняются. Заказ должен показывать те же цифры, что видел клиент при оплате. FK позволяет найти исходную запись справочника для аудита, но копия гарантирует неизменность отчётов. |
| **Производительность отчётов** | Агрегаты (`SUM(total_rub)`, `AVG(total_rub)`) не требуют JOIN к справочникам и пересчёта. |
| **Независимость от удалений** | Даже если админ деактивирует тариф или удаляет курс (soft delete), заказ остаётся валидным. `ON DELETE RESTRICT` на FK запретит удаление справочника, если на него ссылаются заказы. |
| **Аудит и споры** | При претензии клиента можно показать: «Вот курс, который был в заказе, и вот запись в exchange_rates, откуда он взят». |
| **Повторный расчёт (recalc)** | Админ может запустить пересчёт по текущим курсам/тарифам — для этого нужны FK. Результат сравнивается со снимком (`total_rub` vs `recalculated_total`). |

### Правило: снимок — первичный источник истины для финансов
Все отчёты, выплаты менеджерам, налоговые декларации строятся по полям снимка (`total_rub`, `delivery_cost_rub`, `exchange_rate_used`, `commission_percent`). FK используются только для справочной информации и админских инструментов «пересчитать по нынешним тарифам».

## 6. Триггеры

### `trg_order_status_history` (AFTER UPDATE ON orders)
```sql
-- Срабатывает при изменении status_id
-- Вставляет запись в order_status_history:
-- order_id, status_id (NEW), changed_by_user_id (из current_setting('app.current_user_id')), comment (NULL)
-- Использует SECURITY DEFINER функцию для доступа к контексту сессии
```

### `trg_updated_at` (BEFORE UPDATE на таблицах с updated_at)
```sql
-- Автоматически проставляет updated_at = now()
```

## 7. Функции PL/pgSQL

### `fn_calculate_order_total(order_id) RETURNS numeric(12,2)`
```sql
-- Вход: order_id
-- Логика:
-- 1. Берёт order_items: SUM(quantity * price_cny) = subtotal_cny
-- 2. Берёт актуальный курс из exchange_rates (или переданный в заказе exchange_rate_used)
-- 3. Берёт комиссию из orders.commission_percent (или настройку по умолчанию)
-- 4. Берёт вес: SUM(quantity * weight_kg) → подбирает тариф из delivery_tariffs
-- 5. delivery_cost_rub = base_cost + weight_kg * per_kg_cost
-- 6. total_rub = subtotal_cny * rate * (1 + commission/100) + delivery_cost_rub
-- Возвращает total_rub
```

### `fn_get_current_exchange_rate() RETURNS numeric(12,6)`
```sql
-- Возвращает rate из exchange_rates WHERE is_active AND base='CNY' AND target='RUB'
-- ORDER BY valid_from DESC LIMIT 1
-- Используется в кэше Redis (TTL 1h)
```

## 8. Представления (Views)

### `v_manager_queue`
```sql
-- Очередь менеджера: заказы в статусах awaiting_payment, paid, purchased
-- Поля: order_id, order_number, customer_name, customer_phone, status_name,
--       total_rub, created_at, items_count, weight_kg, manager_comment
-- ORDER BY sort_order статуса, created_at
```

### `v_orders_summary`
```sql
-- Сводка для админки/статистики:
-- status_name, orders_count, total_revenue_rub, avg_order_rub,
-- avg_days_from_created_to_paid, avg_days_from_paid_to_delivered
-- GROUP BY status_name
```

### `v_customer_orders` (опционально)
```sql
-- Заказы клиента с последними статусами для каталога "Мои заказы"
-- order_id, order_number, status_name, total_rub, created_at, latest_status_at
```

## 9. Сложные запросы для EXPLAIN ANALYZE (Фаза 2)

### Запрос 1: Очередь менеджера с агрегацией
```sql
SELECT o.id, o.order_number, u.full_name AS customer_name, u.phone,
       os.name_ru AS status, o.total_rub, o.created_at,
       COUNT(oi.id) AS items_count, SUM(oi.quantity * oi.weight_kg) AS total_weight_kg
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_statuses os ON o.status_id = os.id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.status_id IN (2,3,4) -- awaiting_payment, paid, purchased
GROUP BY o.id, u.full_name, u.phone, os.name_ru, o.total_rub, o.created_at
ORDER BY os.sort_order, o.created_at;
```

### Запрос 2: Статистика по месяцам
```sql
SELECT DATE_TRUNC('month', o.created_at) AS month,
       COUNT(*) AS orders_count,
       SUM(o.total_rub) AS revenue_rub,
       AVG(o.total_rub) AS avg_order_rub,
       COUNT(*) FILTER (WHERE o.status_id = 8) AS delivered_count -- delivered
FROM orders o
WHERE o.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', o.created_at)
ORDER BY month DESC;
```

> Для каждого: `EXPLAIN ANALYZE` до создания индексов → создание индексов → `EXPLAIN ANALYZE` после. Результаты фиксируются в `docs/DB.md`.

## 10. Seed данные (план)

- **roles**: 3 записи (customer, manager, admin)
- **users**: 3 тестовых (по одному на роль) + 7 случайных customer
  - Пароли: `bcrypt('password123')`
- **marketplaces**: 6 записей (taobao, tmall, 1688, pinduoduo, jd, poizon)
- **products**: 30+ товаров, распределённых по маркетплейсам, с ценами 50–5000 CNY, весами 0.1–5 кг
- **delivery_tariffs**: 5 тарифов (например: до 0.5кг, 0.5–1кг, 1–2кг, 2–5кг, 5+кг)
- **exchange_rates**: 5 исторических + 1 текущий активный
- **orders**: 20+ заказов, покрывающие все статусы жизненного цикла
- **order_items**: 2–4 позиции на заказ
- **payments**: успешные/неуспешные для оплаченных заказов
- **shipments**: для заказов в статусах shipped_from_china и далее
- **order_status_history**: автозаполняется триггером, но для сида вручную добавим историю переходов

## 11. Типы данных — сводка (соответствует ER.md)

| Категория | Тип | Примеры полей |
|-----------|-----|---------------|
| Деньги (RUB, CNY) | `numeric(12,2)` | `total_rub`, `price_cny`, `delivery_cost_rub`, `amount_rub` |
| Курс валют | `numeric(12,6)` | `rate`, `exchange_rate_used` |
| Вес (кг) | `numeric(10,3)` | `weight_kg` (до грамма) |
| Проценты | `numeric(5,2)` | `commission_percent` |
| Время | `timestamptz` | все `created_at`, `updated_at`, даты заказа/оплаты/доставки |
| JSON | `jsonb` | `images`, `attributes`, `selected_attributes`, `metadata` |
| Идентификаторы | `bigint` (PK/FK) | `id`, `*_id` |
| Коды/статусы | `varchar` | `code`, `status`, `type`, `currency` |