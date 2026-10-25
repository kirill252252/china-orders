# ER-диаграмма (Mermaid)

```mermaid
erDiagram
    ROLES ||--o{ USERS : "has"
    USERS ||--o{ ADDRESSES : "has"
    USERS ||--o| CARTS : "owns"
    USERS ||--o{ ORDERS : "places"
    USERS ||--o{ ORDER_STATUS_HISTORY : "changes_by"
    USERS ||--o{ USER_PRODUCTS : "personal_list"
    PRODUCTS ||--o{ USER_PRODUCTS : "in_lists"
    ADDRESSES ||--o{ ORDERS : "shipping_address"
    MARKETPLACES ||--o{ PRODUCTS : "lists"
    PRODUCTS ||--o{ CART_ITEMS : "in"
    PRODUCTS ||--o{ ORDER_ITEMS : "in"
    CARTS ||--o{ CART_ITEMS : "contains"
    ORDERS ||--o{ ORDER_ITEMS : "contains"
    ORDERS ||--o{ ORDER_STATUS_HISTORY : "tracks"
    ORDERS ||--o{ PAYMENTS : "paid_by"
    ORDERS ||--o{ SHIPMENTS : "shipped_via"
    ORDER_STATUSES ||--o{ ORDERS : "current_status"
    ORDER_STATUSES ||--o{ ORDER_STATUS_HISTORY : "status"
    ORDER_STATUSES ||--o{ ORDER_STATUS_TRANSITIONS : "from_status"
    ORDER_STATUSES ||--o{ ORDER_STATUS_TRANSITIONS : "to_status"
    EXCHANGE_RATES ||--o{ ORDERS : "rate_snapshot"
    DELIVERY_TARIFFS ||--o{ ORDERS : "tariff_snapshot"

    ROLES {
        int id PK
        varchar name UK
        text description
        timestamptz created_at
    }

    USERS {
        int id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar phone
        int role_id FK
        boolean is_active
        boolean is_super_admin
        timestamptz created_at
        timestamptz updated_at
    }

    ADDRESSES {
        int id PK
        int user_id FK
        varchar type
        varchar country
        varchar region
        varchar city
        varchar street
        varchar building
        varchar apartment
        varchar postal_code
        boolean is_default
        timestamptz created_at
    }

    MARKETPLACES {
        int id PK
        varchar code UK
        varchar name
        varchar base_url
        boolean is_active
        timestamptz created_at
    }

    PRODUCTS {
        int id PK
        int marketplace_id FK
        varchar external_id
        varchar name
        text description
        numeric(12,2) price_cny
        varchar currency
        varchar sku
        numeric(10,3) weight_kg
        varchar main_image_url
        jsonb images
        jsonb attributes
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    USER_PRODUCTS {
        bigint user_id PK, FK
        bigint product_id PK, FK
        timestamptz created_at
    }

    CARTS {
        int id PK
        int user_id FK,UK
        timestamptz created_at
        timestamptz updated_at
    }

    CART_ITEMS {
        int id PK
        int cart_id FK
        int product_id FK
        int quantity
        jsonb selected_attributes
        numeric(12,2) price_cny_at_add
        timestamptz created_at
        timestamptz updated_at
    }

    ORDERS {
        int id PK
        varchar order_number UK
        int user_id FK
        int status_id FK
        int exchange_rate_id FK
        int delivery_tariff_id FK
        numeric(12,2) subtotal_cny
        numeric(12,6) exchange_rate_used
        numeric(5,2) commission_percent
        numeric(12,2) delivery_cost_rub
        numeric(12,2) total_rub
        int shipping_address_id FK
        text manager_comment
        text customer_comment
        timestamptz created_at
        timestamptz updated_at
        timestamptz paid_at
        timestamptz completed_at
        timestamptz cancelled_at
    }

    ORDER_ITEMS {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        jsonb selected_attributes
        numeric(12,2) price_cny
        numeric(10,3) weight_kg
        timestamptz created_at
    }

    ORDER_STATUSES {
        int id PK
        varchar code UK
        varchar name_ru
        int sort_order
        boolean is_final
        boolean is_cancelled
        timestamptz created_at
    }

    ORDER_STATUS_TRANSITIONS {
        int from_status_id PK, FK
        int to_status_id PK, FK
    }

    ORDER_STATUS_HISTORY {
        int id PK
        int order_id FK
        int status_id FK
        int changed_by_user_id FK
        text comment
        timestamptz created_at
    }

    PAYMENTS {
        int id PK
        int order_id FK
        varchar payment_method
        varchar status
        numeric(12,2) amount_rub
        varchar external_id
        jsonb metadata
        timestamptz created_at
        timestamptz paid_at
    }

    SHIPMENTS {
        int id PK
        int order_id FK
        varchar tracking_number
        varchar carrier
        numeric(10,3) weight_kg
        numeric(14,2) declared_value_cny
        timestamptz shipped_at
        timestamptz estimated_arrival
        timestamptz arrived_at
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    EXCHANGE_RATES {
        int id PK
        varchar base_currency
        varchar target_currency
        numeric(12,6) rate
        varchar source
        boolean is_active
        timestamptz valid_from
        timestamptz valid_until
        timestamptz created_at
    }

    DELIVERY_TARIFFS {
        int id PK
        varchar name
        numeric(10,3) min_weight_kg
        numeric(10,3) max_weight_kg
        numeric(12,2) base_cost_rub
        numeric(12,2) per_kg_cost_rub
        int min_days
        int max_days
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    SETTINGS {
        varchar key PK
        varchar value
    }

    SCHEMA_MIGRATIONS {
        bigint id PK
        varchar name
        timestamptz applied_at
    }
```

Таблицы `SETTINGS` и `SCHEMA_MIGRATIONS` с остальными не связаны: это настройки «ключ-значение» и служебный журнал применённых миграций.

## Представления (не таблицы)

| Представление | Назначение |
|---------------|-----------|
| `v_customer_orders` | список заказов покупателя (номер, статус, сумма, число позиций, даты этапов) |
| `v_manager_queue` | очередь менеджера: заказы в статусах «Ожидает оплаты», «Оплачен», «Выкуплен» |
| `v_orders_summary` | сводка по статусам: число заказов, суммарная выручка, средний чек, среднее время от создания до оплаты и от оплаты до доставки в днях |

## Составные ограничения уникальности (не показаны в диаграмме)

| Таблица | Ограничение |
|---------|-------------|
| `products` | `UNIQUE (marketplace_id, external_id)` |
| `cart_items` | `UNIQUE (cart_id, product_id, selected_attributes)` |
| `exchange_rates` | `UNIQUE (base_currency, target_currency, valid_from)` |
| `user_products` | `PRIMARY KEY (user_id, product_id)` |
| `order_status_transitions` | `PRIMARY KEY (from_status_id, to_status_id)` |
| `users` | частичный уникальный индекс `ux_users_single_super_admin` по `is_super_admin` при значении true: не более одного главного администратора |

## Прочие ограничения

| Таблица | Ограничение |
|---------|-------------|
| `users` | `CHECK (NOT is_super_admin OR is_active)`: главный администратор не может быть неактивен |
| `user_products` | внешние ключи на `users` и `products` с `ON DELETE CASCADE` |
| `order_status_transitions` | внешние ключи на `order_statuses` с `ON DELETE RESTRICT` |

## Значения по умолчанию (не показаны в диаграмме)

| Таблица | Поле | Default |
|---------|------|---------|
| `order_status_history` | `created_at` | `now()` |
| `orders` | `status_id` | `1` (new) |
| `users` | `is_active` | `true` |
| `users` | `is_super_admin` | `false` |
| `addresses` | `is_default` | `false` |
| `products` | `is_active` | `true` |
| `marketplaces` | `is_active` | `true` |
| `exchange_rates` | `is_active` | `true` |
| `delivery_tariffs` | `is_active` | `true` |
| `user_products` | `created_at` | `now()` |
| `schema_migrations` | `applied_at` | `now()` |

## Пояснения к нормализации (3НФ)

1. **Users** — только атрибуты пользователя. Роли вынесены в справочник `roles`. Признак `is_super_admin` ограничен индексом и CHECK на уровне БД.
2. **Addresses** — отдельная таблица, пользователь может иметь несколько адресов (доставка, биллинг). Связь с заказами через `shipping_address_id`.
3. **Marketplaces** — справочник маркетплейсов, расширяем без миграций схемы.
4. **Products** — товары, привязанные к маркетплейсу. `external_id` уникален в рамках маркетплейса. Цена и вес хранятся для расчётов.
5. **User_products** — связь «многие ко многим» между пользователями и товарами (личный список). Выделена в отдельную таблицу, чтобы один товар мог входить в списки разных пользователей без дублирования. Удаление из списка удаляет только связь.
6. **Carts / Cart_items** — классическая корзина. `price_cny_at_add` фиксирует цену на момент добавления. Одна корзина на пользователя (`users ||--o| carts`).
7. **Orders / Order_items** — заказы и позиции. Все денежные/весовые показатели зафиксированы на момент оформления (история не меняется при смене курса/цены товара). **Денормализация снимков:** `exchange_rate_used`, `commission_percent`, `delivery_cost_rub`, `total_rub` хранятся копиями; FK `exchange_rate_id`, `delivery_tariff_id` указывают на справочники для аудита.
8. **Order_statuses** — справочник статусов с флагами `is_final`, `is_cancelled` для логики переходов.
9. **Order_status_transitions** — справочник допустимых переходов между статусами. Правила хранятся данными, а не кодом, их читает триггер, блокирующий недопустимые переходы.
10. **Order_status_history** — полный **аудит** смены статусов (кто, когда, комментарий). Заполняется триггером.
11. **Payments** — платёжные попытки, поддержка нескольких попыток/возвратов. Связь только с `orders` (нет прямой связи с `users`).
12. **Shipments** — логистика: трек-номер, перевозчик, вес, даты.
13. **Exchange_rates** — история курсов. `valid_from`/`valid_until` позволяют знать курс на любую дату.
14. **Delivery_tariffs** — тарифы доставки по весовым интервалам. `max_weight_kg` может быть NULL (нет верхнего лимита).
15. **Settings** — настройки «ключ-значение» (сейчас комиссия по умолчанию). Отдельная таблица вместо констант в коде позволяет менять значения без релиза.
16. **Schema_migrations** — служебный журнал применённых SQL-миграций.

## Типы данных — соглашения

| Категория | Тип | Пример |
|-----------|-----|--------|
| Деньги (RUB, CNY) | `numeric(12,2)` | `total_rub`, `price_cny` |
| Курс валют | `numeric(12,6)` | `rate`, `exchange_rate_used` |
| Вес (кг) | `numeric(10,3)` | `weight_kg` (до грамма) |
| Проценты | `numeric(5,2)` | `commission_percent` |
| Время | `timestamptz` | все `created_at`, `updated_at`, даты заказа |
| JSON | `jsonb` | `images`, `attributes`, `selected_attributes`, `metadata` |
| Идентификаторы | `int` или `bigint` | `id`, `*_id` (точные типы в DB.md) |
| Коды/статусы | `varchar` | `code`, `status`, `type` |