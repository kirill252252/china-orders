# China Orders: автоматизация заказов с китайских маркетплейсов

Веб-приложение для оформления и отслеживания заказов с Taobao, Tmall, 1688, Pinduoduo, JD и Poizon. Разрабатывается как курсовой проект; акцент на нормализованной базе данных PostgreSQL.

Покупатель добавляет товар по ссылке или вручную, видит стоимость в рублях, оформляет заказ и следит за статусом. Менеджер ведёт заказы по цепочке статусов. Администратор управляет курсом, комиссией, тарифами доставки и пользователями. Импорт товаров по ссылке работает через тестовый провайдер (MockProvider).

## Технологии

- **Frontend:** React 18, Vite, React Router, обычный CSS (`src/styles/global.css`)
- **Backend:** Node.js, Express (JavaScript, ES-модули)
- **БД:** PostgreSQL, SQL-миграции
- **Кэш и лимиты:** Redis (ioredis)
- **Безопасность:** JWT (access) + refresh в httpOnly cookie, bcrypt, Helmet, CORS, Zod, параметризованный SQL
- **Запуск:** Docker Compose

## Запуск (разработка)

Нужен Docker Desktop.

```
copy .env.example .env
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec backend npm run migrate:up
docker compose -f docker-compose.dev.yml exec backend npm run seed
```

- Приложение: http://localhost:5173 (запросы `/api` проксируются на backend)
- API: http://localhost:3000/api/v1
- Логи: `docker compose -f docker-compose.dev.yml logs -f backend`

Остановка: `docker compose -f docker-compose.dev.yml down`. Флаг `-v` не использовать: он удаляет данные БД.

Docker на Windows не отслеживает изменения файлов backend, поэтому после правок кода:
`docker compose -f docker-compose.dev.yml up -d --force-recreate backend`.

## Миграции

```
docker compose -f docker-compose.dev.yml exec backend npm run migrate:up
docker compose -f docker-compose.dev.yml exec backend npm run migrate:down
docker compose -f docker-compose.dev.yml exec backend node scripts/migrate.js status
```

Каждая миграция состоит из пары файлов `.up.sql` и `.down.sql`. Применённые старые миграции не редактируются, изменения оформляются новой миграцией.

## Учётные записи (только для разработки)

Пароль у всех: `Test1234!`

| Роль | Email |
|------|-------|
| Главный администратор | admin@test.local |
| Менеджер | manager@test.local |
| Покупатель | customer@test.local, customer2@test.local, customer3@test.local |

Назначать и блокировать администраторов может только главный администратор.

## Роли

- **Покупатель:** личный список товаров, корзина, адреса, заказы, оплата (заглушка), калькулятор, профиль.
- **Менеджер:** очередь заказов, смена статусов, отгрузка (перевозчик, трек-номер), заметки.
- **Администратор:** всё из роли менеджера, плюс курс, комиссия, тарифы, пользователи, статистика.

## Статусы заказа

```
Новый → Ожидает оплаты → Оплачен → Выкуплен → Отправлен из Китая → В пути → Прибыл на склад → Доставлен
```

Отмена возможна из статусов «Новый», «Ожидает оплаты», «Оплачен», «Выкуплен» и требует причины. Недопустимые переходы блокирует триггер БД.

## Расчёт стоимости

```
Товары = Цена в юанях × Количество × Курс
Итого  = Товары × (1 + Комиссия / 100) + Базовая стоимость тарифа + Вес × Цена за кг
```

Тариф выбирается по суммарному весу заказа. Курс, комиссия и тарифы хранятся в БД и меняются администратором. В заказе фиксируются снимки курса, комиссии и тарифа, поэтому последующие изменения старые заказы не затрагивают.

Пример: товар 688 ¥, 0,28 кг, курс 12,5, комиссия 5 %, тариф «До 1 кг» (300 ₽ + 150 ₽/кг): 1 шт = 9 372 ₽, 2 шт = 18 444 ₽.

## Redis

- кэш текущего курса (1 час, сбрасывается при смене курса; заказ всегда читает курс из БД);
- кэш каталога (120 секунд, ключ с версией);
- хранение refresh-сессий;
- ограничение частоты запросов: вход, импорт, оформление заказа, калькулятор, смена пароля.

## Структура

```
backend/
  src/
    config/        подключения (БД, Redis), настройки
    middleware/    авторизация, роли, валидация, лимиты
    modules/       auth, products, cart, addresses, orders, manager, admin, calc, profile
    utils/         ошибки, обёртки
  scripts/         migrate.js, seed.js, regression.ps1, test-lib.ps1
frontend/
  src/
    api/           клиент API
    context/       состояние авторизации
    components/    компоненты интерфейса
    pages/         страницы
    utils/         форматирование, статусы, роли
    styles/        global.css
docs/              ER.md, DB.md, API.md, EXPLAIN.md, COURSEWORK.md
```

Каждый модуль backend состоит из маршрутов, контроллера, сервиса и Zod-схем.

## Тестирование

Регрессионный скрипт проверяет API целиком (авторизация, права, корзина, заказы, оплата, статусы, тарифы, курс, кэш, лимиты, профиль) и после прогона возвращает данные в исходное состояние:

```
powershell -ExecutionPolicy Bypass -File backend\scripts\regression.ps1
```

Результат сохраняется в `docs/regression-result.txt`. Последний прогон: 229 проверок, 0 ошибок.

## Документация

- [ER-диаграмма](docs/ER.md)
- [Описание базы данных](docs/DB.md)
- [Планы выполнения запросов (EXPLAIN)](docs/EXPLAIN.md)
- [Описание API](docs/API.md)
- [Материалы для пояснительной записки](docs/COURSEWORK.md)

## Переменные окружения

Шаблон в `.env.example`. Перед использованием вне разработки замените пароль БД и оба JWT-секрета. Файл `.env` в репозиторий не попадает.