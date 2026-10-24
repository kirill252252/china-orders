// Сервис для работы со статистикой (админка).
import { query } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

/**
 * Получить статистику за период
 * @param {Object} params - Параметры периода
 * @param {string} params.from - Начало периода (YYYY-MM-DD)
 * @param {string} params.to - Конец периода (YYYY-MM-DD)
 * @returns {Promise<Object>}
 */

// Проверяет, что строка YYYY-MM-DD это существующая календарная дата
function parseDay(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError('Некорректная дата', 400, 'BAD_REQUEST');
  }
  return date;
}

export async function getStats({ from, to }) {
  // Установка значений по умолчанию
  const toDate = to ? parseDay(to) : new Date();
  toDate.setUTCHours(0, 0, 0, 0);

  const fromDate = from
    ? parseDay(from)
    : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);
  fromDate.setUTCHours(0, 0, 0, 0);

  // Валидация периода
  if (fromDate > toDate) {
    throw new AppError('Начало периода не может быть позже конца', 400, 'BAD_REQUEST');
  }

  const diffDays = Math.floor((toDate - fromDate) / (24 * 60 * 60 * 1000)) + 1;
  if (diffDays > 366) {
    throw new AppError('Период не может превышать 366 дней', 400, 'BAD_REQUEST');
  }

  // Подготовка временных меток для запроса
  const fromTs = fromDate.toISOString();
  const toTs = new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // Заказы по статусам
  const statusResult = await query(
    `SELECT s.code, s.name_ru, count(o.id) AS cnt
     FROM order_statuses s
     LEFT JOIN orders o ON o.status_id = s.id
        AND o.created_at >= $1::timestamptz
        AND o.created_at < $2::timestamptz
     GROUP BY s.id
     ORDER BY s.sort_order`,
    [fromTs, toTs]
  );

  const byStatus = statusResult.rows.map((row) => ({
    code: row.code,
    nameRu: row.name_ru,
    count: Number(row.cnt),
  }));

  const totalOrders = byStatus.reduce((sum, s) => sum + s.count, 0);

  // Пользователи: всего и активные
  const usersResult = await query(
    `SELECT count(*) AS total, count(*) FILTER (WHERE is_active) AS active FROM users`
  );
  const usersTotal = Number(usersResult.rows[0].total);
  const usersActive = Number(usersResult.rows[0].active);

  // Пользователи по ролям
  const rolesResult = await query(
    `SELECT r.name, count(u.id) AS cnt
     FROM roles r
     LEFT JOIN users u ON u.role_id = r.id
     GROUP BY r.id
     ORDER BY r.id`
  );
  const byRole = rolesResult.rows.map((row) => ({
    role: row.name,
    count: Number(row.cnt),
  }));

  // Выручка: оплаченные заказы (кроме отменённых)
  const revenueResult = await query(
    `SELECT COALESCE(sum(o.total_rub), 0) AS total, count(*) AS cnt
     FROM orders o
     JOIN order_statuses s ON s.id = o.status_id
     WHERE o.paid_at >= $1::timestamptz
       AND o.paid_at < $2::timestamptz
       AND s.code <> 'cancelled'`,
    [fromTs, toTs]
  );
  const revenueTotal = Number(revenueResult.rows[0].total);
  const paidOrdersCount = Number(revenueResult.rows[0].cnt);
  const averageOrderRub = paidOrdersCount > 0 ? Math.round((revenueTotal / paidOrdersCount) * 100) / 100 : 0;

  // По дням: заказы и выручка
  const byDayResult = await query(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
            (SELECT count(*) FROM orders o WHERE o.created_at >= d.day AND o.created_at < d.day + interval '1 day') AS orders_count,
            (SELECT COALESCE(sum(o.total_rub), 0)
             FROM orders o
             JOIN order_statuses s ON s.id = o.status_id
             WHERE o.paid_at >= d.day
               AND o.paid_at < d.day + interval '1 day'
               AND s.code <> 'cancelled') AS revenue
     FROM generate_series($1::timestamptz, $2::timestamptz - interval '1 day', interval '1 day') AS d(day)
     ORDER BY d.day`,
    [fromTs, toTs]
  );
  const byDay = byDayResult.rows.map((row) => ({
    date: row.date,
    ordersCount: Number(row.orders_count),
    revenueRub: Number(row.revenue),
  }));

  // Форматирование дат для ответа
  const formatDate = (date) => date.toISOString().split('T')[0];

  return {
    period: {
      from: formatDate(fromDate),
      to: formatDate(toDate),
    },
    orders: {
      total: totalOrders,
      byStatus,
    },
    users: {
      total: usersTotal,
      active: usersActive,
      byRole,
    },
    revenue: {
      totalRub: Math.round(revenueTotal * 100) / 100,
      paidOrdersCount,
      averageOrderRub,
    },
    byDay,
  };
}