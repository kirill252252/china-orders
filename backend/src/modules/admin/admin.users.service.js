// Сервис для работы с пользователями (админка).
import { query, tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { revokeAllUserTokens } from '../../utils/jwt.js';

/**
 * SQL для получения пользователя с ролью и количеством заказов
 */
const USER_SELECT = `
  SELECT u.id, u.email, u.full_name, u.phone, r.name AS role, u.is_active, u.created_at,
         (SELECT count(*) FROM orders o WHERE o.user_id = u.id) AS orders_count
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.id = $1
`;

/**
 * Маппинг строки БД в объект пользователя
 * @param {Object} row - Строка из БД
 * @returns {Object}
 */
export function mapUser(row) {
  return {
    id: String(row.id),
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    ordersCount: Number(row.orders_count),
  };
}

/**
 * Получить список пользователей с пагинацией и фильтрами
 * @param {Object} params - Параметры запроса
 * @param {number} params.page - Номер страницы
 * @param {number} params.limit - Количество элементов на странице
 * @param {string} [params.role] - Фильтр по роли (customer|manager|admin)
 * @param {string} [params.isActive] - Фильтр по активности ('true'|'false')
 * @param {string} [params.q] - Поиск по email или ФИО
 * @returns {Promise<{items: Array, page: number, limit: number, total: number, totalPages: number}>}
 */
export async function listUsers({ page, limit, role, isActive, q }) {
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Фильтр по роли
  if (role) {
    conditions.push(`r.name = $${paramIndex}`);
    params.push(role);
    paramIndex++;
  }

  // Фильтр по активности
  if (isActive !== undefined) {
    conditions.push(`u.is_active = $${paramIndex}`);
    params.push(isActive === 'true');
    paramIndex++;
  }

  // Поиск по email или ФИО
  if (q) {
    const searchTerm = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(`(u.email ILIKE $${paramIndex} ESCAPE '\\' OR u.full_name ILIKE $${paramIndex} ESCAPE '\\')`);
    params.push(searchTerm);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Общее количество
  const countResult = await query(
    `SELECT count(*) FROM users u JOIN roles r ON r.id = u.role_id ${whereClause}`,
    params
  );
  const total = Number(countResult.rows[0].count);
  const totalPages = Math.ceil(total / limit);

  // Данные с пагинацией
  params.push(limit, offset);
  const dataResult = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, r.name AS role, u.is_active, u.created_at,
            (SELECT count(*) FROM orders o WHERE o.user_id = u.id) AS orders_count
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ${whereClause}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  const items = dataResult.rows.map(mapUser);

  return { items, page, limit, total, totalPages };
}

/**
 * Обновить пользователя (роль и/или активность)
 * @param {string} adminId - ID администратора, выполняющего действие
 * @param {string} id - ID пользователя
 * @param {Object} data - Данные для обновления {role?, isActive?}
 * @returns {Promise<Object>}
 */
export async function updateUser(adminId, id, data) {
  // Флаг: нужно ли отозвать сессии (изменилась роль или isActive стал false)
  const shouldRevokeSessions = data.role !== undefined || data.isActive === false;

  const updatedUser = await tx(async (client) => {
    // 1) Проверить существование пользователя и заблокировать строку
    const userResult = await client.query(
      `SELECT u.id FROM users u WHERE u.id = $1 FOR UPDATE`,
      [id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
    }

    // 2) Нельзя менять свою роль или блокировку
    if (String(id) === String(adminId)) {
      throw new AppError('Нельзя изменить собственную роль или блокировку', 409, 'CONFLICT');
    }

    // 3) Обновить роль, если передана
    if (data.role !== undefined) {
      const roleResult = await client.query(
        `SELECT id FROM roles WHERE name = $1`,
        [data.role]
      );

      if (roleResult.rows.length === 0) {
        throw new AppError('Роль не найдена', 400, 'BAD_REQUEST');
      }

      await client.query(
        `UPDATE users SET role_id = $2 WHERE id = $1`,
        [id, roleResult.rows[0].id]
      );
    }

    // 4) Обновить активность, если передана
    if (data.isActive !== undefined) {
      await client.query(
        `UPDATE users SET is_active = $2 WHERE id = $1`,
        [id, data.isActive]
      );
    }

    // 5) Прочитать обновлённого пользователя
    const result = await client.query(USER_SELECT, [id]);

    return mapUser(result.rows[0]);
  });

  // 6) После успешной транзакции отозвать все сессии, если нужно
  if (shouldRevokeSessions) {
    await revokeAllUserTokens(id);
  }

  return updatedUser;
}