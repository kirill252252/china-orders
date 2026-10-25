# Описание базы данных

СУБД: PostgreSQL 16. Схема описана по фактическому состоянию базы после миграций 001–015: 19 таблиц и 3 представления. Для проверки типов и ограничений использованы системные каталоги PostgreSQL.

## 1. Таблицы и назначение

| Таблица | Назначение | Строк на момент выгрузки |
|---------|------------|--------------------------|
| `roles` | Справочник ролей (customer, manager, admin) | 3 |
| `users` | Пользователи системы | 9 |
| `addresses` | Адреса доставки и биллинга | 5 |
| `marketplaces` | Поддерживаемые маркетплейсы | 6 |
| `products` | Товары каталога | 40 |
| `user_products` | Личные списки товаров пользователей (связь «многие ко многим») | 360 |
| `carts` | Корзины (одна на пользователя) | 9 |
| `cart_items` | Позиции корзин | 1 |
| `orders` | Заказы | 56 |
| `order_items` | Позиции заказов | 69 |
| `order_statuses` | Справочник статусов заказа | 9 |
| `order_status_transitions` | Справочник допустимых переходов статусов | 11 |
| `order_status_history` | Аудит смен статусов | 197 |
| `payments` | Платежи | 40 |
| `shipments` | Отправления (не более одного на заказ) | 12 |
| `exchange_rates` | История курсов валют | 211 |
| `delivery_tariffs` | Тарифы доставки по весу | 3 |
| `settings` | Настройки «ключ-значение» (комиссия по умолчанию) | 1 |
| `schema_migrations` | Журнал применённых миграций | 15 |

Количество строк в `exchange_rates`, `orders` и `order_status_history` включает данные, накопленные при ручной проверке и прогонах регрессионных тестов.

## 2. Нормализация (3НФ)

Каждая таблица удовлетворяет третьей нормальной форме:

- **1НФ:** значения атомарны, повторяющихся групп нет. Нестрого структурированные данные (атрибуты товара, выбранные атрибуты позиции) хранятся в `jsonb` как единое значение.
- **2НФ:** составной ключ только у таблиц связи (`user_products`, `order_status_transitions`), в них нет неключевых атрибутов, зависящих от части ключа. В остальных таблицах ключ суррогатный.
- **3НФ:** неключевые атрибуты не зависят друг от друга. Повторяющиеся сведения вынесены в справочники.

Примеры:
- `users.role_id → roles.id`: название роли не дублируется в `users`.
- `products.marketplace_id → marketplaces.id`: название маркетплейса не дублируется.
- `orders.status_id → order_statuses.id`: статус хранится ссылкой, названия лежат в справочнике.
- `user_products`: личный список вынесен в отдельную таблицу, поэтому один товар может входить в списки разных пользователей без дублирования самого товара.
- Допустимые переходы статусов хранятся данными в `order_status_transitions`, а не зашиты в код.

Осознанная денормализация (снимки заказа) описана в разделе 5.

## 3. Ключи и ограничения

### Первичные ключи

Таблицы-справочники `roles`, `marketplaces`, `order_statuses`, `exchange_rates`, `delivery_tariffs` используют `integer`. Остальные таблицы с суррогатным ключом используют `bigint`. Составные ключи: `user_products (user_id, product_id)`, `order_status_transitions (from_status_id, to_status_id)`. У `settings` ключ `key`.

### Внешние ключи

| Дочерняя колонка | Родитель | ON DELETE | Комментарий |
|------------------|----------|-----------|-------------|
| `users.role_id` | `roles.id` | RESTRICT | роль с пользователями удалить нельзя |
| `addresses.user_id` | `users.id` | CASCADE | |
| `products.marketplace_id` | `marketplaces.id` | RESTRICT | |
| `user_products.user_id` | `users.id` | CASCADE | |
| `user_products.product_id` | `products.id` | CASCADE | |
| `carts.user_id` | `users.id` | CASCADE | |
| `cart_items.cart_id` | `carts.id` | CASCADE | |
| `cart_items.product_id` | `products.id` | RESTRICT | |
| `orders.user_id` | `users.id` | RESTRICT | история заказов сохраняется |
| `orders.status_id` | `order_statuses.id` | RESTRICT | |
| `orders.exchange_rate_id` | `exchange_rates.id` | RESTRICT | ссылка на курс, использованный в заказе |
| `orders.delivery_tariff_id` | `delivery_tariffs.id` | RESTRICT | ссылка на тариф, использованный в заказе |
| `orders.shipping_address_id` | `addresses.id` | SET NULL | адрес можно удалить, заказ останется |
| `order_items.order_id` | `orders.id` | CASCADE | |
| `order_items.product_id` | `products.id` | RESTRICT | |
| `order_status_history.order_id` | `orders.id` | CASCADE | |
| `order_status_history.status_id` | `order_statuses.id` | RESTRICT | |
| `order_status_history.changed_by_user_id` | `users.id` | SET NULL | |
| `order_status_transitions.from_status_id` | `order_statuses.id` | RESTRICT | |
| `order_status_transitions.to_status_id` | `order_statuses.id` | RESTRICT | |
| `payments.order_id` | `orders.id` | CASCADE | |
| `shipments.order_id` | `orders.id` | CASCADE | |

### Ограничения уникальности

| Таблица | Ограничение |
|---------|-------------|
| `users` | `UNIQUE (email)` |
| `roles` | `UNIQUE (name)` |
| `marketplaces` | `UNIQUE (code)` |
| `products` | `UNIQUE (marketplace_id, external_id)` |
| `carts` | `UNIQUE (user_id)` |
| `cart_items` | `UNIQUE (cart_id, product_id, selected_attributes)` |
| `orders` | `UNIQUE (order_number)` |
| `order_statuses` | `UNIQUE (code)` |
| `exchange_rates` | `UNIQUE (base_currency, target_currency, valid_from)` |
| `delivery_tariffs` | `UNIQUE (name)` |
| `schema_migrations` | `UNIQUE (name)` |

### Ограничения CHECK

| Таблица | Условие |
|---------|---------|
| `users` | `NOT is_super_admin OR is_active` (главный администратор не может быть неактивен) |
| `addresses` | `type IN ('delivery', 'billing')` |
| `products` | `price_cny > 0`, `weight_kg >= 0` |
| `cart_items` | `quantity > 0`, `price_cny_at_add >= 0` |
| `orders` | `subtotal_cny`, `commission_percent`, `exchange_rate_used`, `delivery_cost_rub`, `total_rub` не меньше 0 |
| `order_items` | `quantity > 0`, `price_cny >= 0`, `weight_kg >= 0` |
| `order_statuses` | `sort_order >= 0` |
| `payments` | `payment_method IN ('mock', 'card', 'sbp')`, `status IN ('pending', 'success', 'failed', 'refunded')`, `amount_rub >= 0` |
| `shipments` | `carrier IN ('cdek', 'russian_post', 'ems', 'other')`, `weight_kg >= 0`, `declared_value_cny >= 0` |
| `exchange_rates` | `rate > 0`, `source IN ('cbr', 'manual')` |
| `delivery_tariffs` | `min_weight_kg >= 0`, `max_weight_kg > min_weight_kg`, `base_cost_rub >= 0`, `per_kg_cost_rub >= 0`, `min_days >= 0`, `max_days >= 0` |

## 4. Индексы

| Таблица | Индекс | Назначение |
|---------|--------|------------|
| `users` | `users_email_key` (уникальный) | поиск при входе |
| `users` | `idx_users_role_id`, `idx_users_is_active` | фильтры списка пользователей в админке |
| `users` | `ux_users_single_super_admin` (уникальный, частичный: `WHERE is_super_admin`) | не более одного главного администратора |
| `addresses` | `idx_addresses_user_id` | адреса пользователя |
| `addresses` | `ux_addresses_user_default` (уникальный, частичный: `WHERE is_default = true`) | не более одного адреса по умолчанию у пользователя |
| `addresses` | `ux_addresses_user_type_location` (уникальный, `NULLS NOT DISTINCT`) | запрет дубля адреса |
| `products` | `idx_products_marketplace_id`, `idx_products_is_active`, `idx_products_price_cny` | фильтры и сортировка каталога |
| `products` | `idx_products_search` (GIN по `to_tsvector('russian', name \|\| ' ' \|\| description)`) | полнотекстовый поиск |
| `user_products` | `idx_user_products_user_created (user_id, created_at DESC)` | личный список по дате |
| `user_products` | `idx_user_products_product_id` | обратный поиск по товару, ускорение каскадного удаления |
| `cart_items` | `idx_cart_items_product_id` | проверка ссылок на товар |
| `orders` | `idx_orders_user_status_date (user_id, status_id, created_at)` | «Мои заказы» с фильтром по статусу |
| `orders` | `idx_orders_status_id`, `idx_orders_created_at` | очередь менеджера, статистика по датам |
| `orders` | `idx_orders_delivery_tariff_id`, `idx_orders_shipping_address_id` | ускорение проверок внешних ключей |
| `order_items` | `idx_order_items_order_id`, `idx_order_items_product_id` | позиции заказа |
| `order_status_history` | `idx_order_status_history_order_id`, `..._status_id`, `..._created_at` | таймлайн заказа, аналитика |
| `payments` | `idx_payments_order_id`, `idx_payments_status` | платежи заказа, поиск по статусу |
| `shipments` | `ux_shipments_order_id` (уникальный) | не более одного отправления на заказ |
| `shipments` | `idx_shipments_tracking_number` | поиск по трек-номеру |
| `exchange_rates` | `idx_exchange_rates_active (base_currency, target_currency, is_active)` (частичный: `WHERE is_active`) | быстрый поиск текущего курса |
| `delivery_tariffs` | `idx_delivery_tariffs_active` (частичный: `WHERE is_active`) | активные тарифы для расчёта |

Планы выполнения запросов с индексами и без них приведены в `docs/EXPLAIN.md`.

## 5. Снимки заказа (контролируемая денормализация)

В `orders` хранятся копии значений на момент оформления:

- `exchange_rate_used` (`numeric(12,6)`): курс CNY → RUB;
- `commission_percent` (`numeric(5,2)`): комиссия;
- `delivery_cost_rub` (`numeric(12,2)`): стоимость доставки;
- `total_rub` (`numeric(12,2)`): итоговая сумма.

Параллельно хранятся ссылки на справочники `exchange_rate_id` и `delivery_tariff_id`.

| Причина | Объяснение |
|---------|------------|
| Историческая точность | Курсы и тарифы меняются. Заказ показывает те же цифры, что видел покупатель. |
| Производительность | Агрегаты по `total_rub` не требуют соединений со справочниками. |
| Независимость от изменений | Смена курса, комиссии или тарифа не меняет уже оформленные заказы. `ON DELETE RESTRICT` запрещает удалять справочные записи, на которые ссылаются заказы. |
| Аудит | При споре можно найти исходную запись курса или тарифа по ссылке. |

Снимок является первичным источником для финансовых данных. Ссылки на справочники используются для аудита. Цена позиции фиксируется в `order_items.price_cny` по значению `price_cny_at_add` из корзины, то есть по цене, которую видел покупатель.

## 6. Триггеры

| Таблица | Триггер | Момент | Назначение |
|---------|---------|--------|------------|
| `orders` | `trg_log_initial_status` | AFTER INSERT | записывает в историю первый статус заказа |
| `orders` | `trg_order_status_history` | AFTER UPDATE | при смене `status_id` добавляет запись в `order_status_history`; автор берётся из параметра сессии `app.current_user_id` |
| `orders` | `trg_validate_status_transition` | BEFORE UPDATE | сверяет переход с `order_status_transitions`; при недопустимом переходе выбрасывает `check_violation` с сообщением «Недопустимый переход статуса: a -> b. Разрешено из a: …» |
| `users`, `products`, `carts`, `cart_items`, `orders`, `shipments`, `delivery_tariffs` | `trg_<таблица>_updated_at` | BEFORE UPDATE | проставляют `updated_at = now()` (функция `trg_set_updated_at`) |

Приложение перед сменой статуса выполняет `SELECT set_config('app.current_user_id', $1, true)` внутри транзакции, иначе `changed_by_user_id` в истории остаётся пустым.

Правила переходов хранятся в `order_status_transitions`:

| Из статуса | В статус |
|------------|----------|
| new | awaiting_payment, cancelled |
| awaiting_payment | paid, cancelled |
| paid | purchased, cancelled |
| purchased | shipped_from_china, cancelled |
| shipped_from_china | in_transit |
| in_transit | arrived_warehouse |
| arrived_warehouse | delivered |

## 7. Функции PL/pgSQL

| Функция | Назначение |
|---------|-----------|
| `fn_get_current_exchange_rate()` | текущий активный курс CNY → RUB (последний по `valid_from`) |
| `fn_find_delivery_tariff(weight)` | подбирает активный тариф по суммарному весу |
| `fn_calculate_delivery_cost(tariff_id, weight)` | `base_cost_rub + weight × per_kg_cost_rub` |
| `fn_calculate_order_total(order_id)` | считает и записывает итоги заказа по снимку курса, комиссии и тарифа из `orders` |
| `fn_recalculate_order_current(order_id)` | пересчёт заказа по текущим курсу, комиссии и тарифам для сравнения со снимком |
| `set_current_user_id(...)` | служебная функция контекста сессии |
| `trg_log_initial_status`, `trg_log_order_status_change`, `trg_validate_status_transition`, `trg_set_updated_at` | функции соответствующих триггеров |

Формула итоговой суммы:

```
total_rub = subtotal_cny × exchange_rate_used × (1 + commission_percent / 100) + delivery_cost_rub
delivery_cost_rub = base_cost_rub + weight_kg × per_kg_cost_rub
```

Эталон: товар 688 ¥, 0,28 кг, курс 12,5, комиссия 5 %, тариф «До 1 кг» (300 ₽ + 150 ₽/кг): 1 шт = 9 372 ₽, 2 шт = 18 444 ₽.

## 8. Представления

| Представление | Назначение |
|---------------|-----------|
| `v_customer_orders` | список заказов покупателя: номер, статус, сумма, число позиций, даты оплаты, завершения и отмены; на нём построена страница «Мои заказы» |
| `v_manager_queue` | очередь менеджера: заказы только в статусах «Ожидает оплаты», «Оплачен», «Выкуплен» |
| `v_orders_summary` | сводка по статусам: `status_code`, `status_name`, `status_sort_order`, `orders_count`, `total_revenue_rub`, `avg_order_rub`, `avg_days_created_to_paid`, `avg_days_paid_to_delivered` |

## 9. Миграции

Каждая миграция состоит из пары файлов `.up.sql` и `.down.sql`. Применённые миграции не редактируются, изменения оформляются новой миграцией.

| Миграция | Содержание |
|----------|-----------|
| 001_init | базовая инициализация |
| 002_schema | таблицы и ограничения |
| 003_triggers | триггеры |
| 004_functions | функции расчёта |
| 005_views | представления |
| 006_fix_calc | исправление расчёта |
| 007_status_rules | правила переходов статусов |
| 008_indexes | индексы |
| 009_fix_transition_msg, 010_fix_transition_list | текст и список в сообщении о недопустимом переходе |
| 011_addresses_unique, 012_fix_default_address | уникальность адреса, один адрес по умолчанию |
| 013_shipments_unique | одно отправление на заказ |
| 014_user_products | личные списки товаров |
| 015_super_admin | признак главного администратора, индекс и CHECK |

## 10. Типы данных

| Категория | Тип | Примеры |
|-----------|-----|---------|
| Деньги (RUB, CNY) | `numeric(12,2)` | `total_rub`, `price_cny`, `delivery_cost_rub` |
| Курс валют | `numeric(12,6)` | `rate`, `exchange_rate_used` |
| Вес (кг) | `numeric(10,3)` | `weight_kg` (до грамма) |
| Проценты | `numeric(5,2)` | `commission_percent` |
| Время | `timestamptz` | все `created_at`, `updated_at`, даты заказа |
| JSON | `jsonb` | `images`, `attributes`, `selected_attributes`, `metadata` |
| Идентификаторы | `bigint` или `integer` | `bigint` у таблиц данных, `integer` у справочников |
| Коды и статусы | `varchar` | `code`, `status`, `type`, `currency` |