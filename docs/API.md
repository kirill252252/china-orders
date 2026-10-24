# API Endpoints (OpenAPI 3.0 outline)

Base URL: `/api/v1`

## Формат ответа
```json
// Успех
{ "success": true, "data": {...}, "meta": {...} }

// Ошибка
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

## Пагинация
Query: `page=1&limit=20` → meta: `{ page, limit, total, totalPages }`

---

## Итоговый список — 30 эндпоинтов

| # | Method | Path | Roles | Описание |
|---|--------|------|-------|----------|
| 1 | POST | `/auth/register` | public | Регистрация (role=customer по умолчанию) |
| 2 | POST | `/auth/login` | public | Логин → access JWT (15 мин) + refresh в httpOnly cookie |
| 3 | POST | `/auth/refresh` | public | Обновление access токена по refresh из cookie |
| 4 | POST | `/auth/logout` | auth | Инвалидация refresh токена в Redis |
| 5 | GET | `/auth/me` | auth | Текущий пользователь (требует access token) |
| 6 | GET | `/users` | admin | Список пользователей (фильтры: role, is_active, q) |
| 7 | PATCH | `/users/:id` | admin | Обновление профиля (role, is_active в теле) |
| 8 | GET | `/addresses` | auth (own) | Мои адреса |
| 9 | POST | `/addresses` | auth (own) | Создать адрес |
| 10 | PATCH | `/addresses/:id` | auth (own) | Обновить адрес (в т.ч. is_default) |
| 11 | DELETE | `/addresses/:id` | auth (own) | Удалить адрес |
| 12 | GET | `/products` | public | Каталог (фильтры: marketplace, q, min_price, max_price, in_stock) |
| 13 | GET | `/products/:id` | public | Детали товара |
| 14 | POST | `/products/import` | auth | **Импорт по URL** — `parseUrl` + `fetchProduct` (MockProvider) |
| 15 | POST | `/products` | admin | Ручное создание товара |
| 16 | GET | `/cart` | auth (own) | Моя корзина с расчётом стоимости |
| 17 | POST | `/cart/items` | auth (own) | Добавить товар (product_id, quantity, selected_attributes) |
| 18 | PATCH | `/cart/items/:id` | auth (own) | Изменить количество |
| 19 | DELETE | `/cart/items/:id` | auth (own) | Удалить позицию |
| 20 | GET | `/orders` | auth (own), manager, admin | Список с фильтрами: `?status=`, `?date_from=`, `?date_to=`, `?page=`, `?limit=` |
| 21 | GET | `/orders/:id` | auth (own), manager, admin | Детали заказа + таймлайн статусов |
| 22 | POST | `/orders` | auth (own) | Создать заказ из корзины (транзакция: заказ + списание корзины + платёж pending) |
| 23 | PATCH | `/orders/:id/status` | manager, admin | Смена статуса (валидация переходов FSM) |
| 24 | POST | `/orders/:id/pay` | auth (own) | **Мок-оплата** — создаёт payment success, меняет заказ на `paid` |
| 25 | PUT | `/orders/:id/shipment` | manager, admin | Ввод/обновление отгрузки: трек-номер, вес, перевозчик, даты |
| 26 | GET | `/exchange-rates` | auth | История курсов |
| 27 | POST | `/exchange-rates` | admin | Завести курс (base=CNY, target=RUB, rate, valid_from, source) |
| 28 | GET | `/delivery-tariffs` | auth | Список активных тарифов доставки |
| 29 | PATCH | `/delivery-tariffs/:id` | admin | Обновить тариф (min_weight, max_weight, base_cost, per_kg_cost, min/max_days, is_active) |
| 30 | GET | `/stats` | auth | Статистика: для customer — свои заказы/суммы; для manager — очередь/средние сроки; для admin — общая выручка, по месяцам/статусам/ролям |

---

## Rate Limiting (Redis)
- `POST /auth/login` — 5 req / 15 min per IP
- `POST /products/import` — 10 req / min per user
- `POST /orders` — 30 req / min per user

---

## RBAC Matrix (30 эндпоинтов)

| Endpoint | customer | manager | admin |
|----------|----------|---------|-------|
| `/auth/*` | ✓ | ✓ | ✓ |
| `GET /users` | ✗ | ✗ | ✓ |
| `PATCH /users/:id` | ✗ | ✗ | ✓ |
| `/addresses` | ✓ (own) | ✗ | ✓ |
| `/products` (GET) | ✓ | ✓ | ✓ |
| `POST /products/import` | ✓ | ✓ | ✓ |
| `POST /products` | ✗ | ✗ | ✓ |
| `/cart` | ✓ (own) | ✗ | ✓ (read) |
| `/orders` (GET, POST) | ✓ (own) | ✓ | ✓ |
| `PATCH /orders/:id/status` | ✗ | ✓ | ✓ |
| `POST /orders/:id/pay` | ✓ (own) | ✗ | ✓ |
| `PUT /orders/:id/shipment` | ✗ | ✓ | ✓ |
| `/exchange-rates` (GET) | ✓ | ✓ | ✓ |
| `POST /exchange-rates` | ✗ | ✗ | ✓ |
| `/delivery-tariffs` (GET) | ✓ | ✓ | ✓ |
| `PATCH /delivery-tariffs/:id` | ✗ | ✗ | ✓ |
| `GET /stats` | ✓ (own) | ✓ | ✓ |

---

## Возможное развитие (перенесено из основного списка)

> Эти эндпоинты не входят в MVP (30 шт.), но запланированы для следующих итераций.

| Method | Path | Назначение |
|--------|------|------------|
| GET | `/users/:id` | Профиль конкретного пользователя |
| DELETE | `/users/:id` | Удаление/деактивация пользователя |
| PATCH | `/users/:id/role` | Отдельный эндпоинт смены роли |
| GET, POST, PATCH, DELETE | `/marketplaces/*` | CRUD маркетплейсов (статический справочник, редко меняется) |
| PATCH, DELETE | `/products/:id` | Обновление/деактивация товара админом |
| DELETE | `/cart` | Полная очистка корзины |
| POST | `/orders/:id/comments` | Комментарии к заказу (вложенный ресурс) |
| GET | `/orders/:id/timeline` | Отдельный эндпоинт таймлайна (сейчас в `GET /orders/:id`) |
| GET, POST, PATCH | `/order-statuses/*` | CRUD справочника статусов (статичный, мигрирует SQL) |
| GET, GET, POST, POST | `/payments/*` | Просмотр платежей, возврат (пока только мок-оплата через `/orders/:id/pay`) |
| GET, GET, POST, PATCH, POST | `/shipments/*` | Полный CRUD отправлений (пока только PUT `/orders/:id/shipment`) |
| PATCH | `/exchange-rates/:id` | Деактивация/обновление курса |
| POST, DELETE | `/delivery-tariffs` | Создание/деактивация тарифа |
| GET | `/manager/queue` | Отдельная очередь менеджера (покрывается `GET /orders?status=awaiting_payment,paid,purchased`) |
| GET | `/manager/stats` | Статистика менеджера (покрывается `GET /stats` для роли manager) |
| GET | `/admin/stats`, `/admin/users/stats`, `/admin/orders/stats` | Админская статистика (покрывается `GET /stats` для роли admin) |

---

## Валидация (Zod-схемы) — ключевые поля

### `POST /auth/register`
```json
{ "email": "string@email", "password": "string(min:8)", "full_name": "string", "phone?": "string" }
```

### `POST /auth/login`
```json
{ "email": "string@email", "password": "string" }
```

### `POST /products/import`
```json
{ "url": "string@url" }
```

### `POST /products` (ручной ввод)
```json
{ "marketplace_id": "int", "external_id": "string", "name": "string", "price_cny": "number>0", "weight_kg": "number>=0", "images?": "string[]", "attributes?": "object" }
```

### `POST /cart/items`
```json
{ "product_id": "int", "quantity": "int>0", "selected_attributes?": "object" }
```

### `POST /orders`
```json
{ "shipping_address_id": "int" }
```

### `PATCH /orders/:id/status`
```json
{ "status_id": "int", "comment?": "string" }
```

### `PUT /orders/:id/shipment`
```json
{ "tracking_number": "string", "carrier": "string", "weight_kg": "number>0", "declared_value_cny?": "number", "shipped_at?": "datetime", "estimated_arrival?": "datetime" }
```

### `POST /exchange-rates`
```json
{ "base_currency": "CNY", "target_currency": "RUB", "rate": "number>0", "valid_from": "datetime", "source": "cbr|manual" }
```

### `PATCH /delivery-tariffs/:id`
```json
{ "min_weight_kg": "number>=0", "max_weight_kg?": "number", "base_cost_rub": "number>=0", "per_kg_cost_rub": "number>=0", "min_days": "int>=0", "max_days": "int>=0", "is_active": "boolean" }
```

---

## Параметры путей
Все параметры пути используют именование `:id` (например `/users/:id`, `/orders/:id`, `/addresses/:id`, `/delivery-tariffs/:id`, `/cart/items/:id`).