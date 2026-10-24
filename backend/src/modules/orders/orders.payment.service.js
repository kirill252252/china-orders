// Оплата заказа (имитация платёжного шлюза).
// Всё выполняется в одной транзакции; ответ читается после коммита.
import { randomUUID } from 'crypto';
import { tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { getOrderById } from './orders.service.js';

/**
 * Оплачивает заказ клиента: new/awaiting_payment -> paid, создаёт запись в payments.
 * @param {string|number} userId - ID пользователя из токена
 * @param {string} orderId - ID заказа
 * @returns {Promise<object>} заказ в формате GET /orders/:id
 */
export async function payOrder(userId, orderId) {
  await tx(async (client) => {
    // Пользователь для триггера истории статусов (локально для транзакции)
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [String(userId)]);

    const orderRes = await client.query(
      `SELECT o.id, o.total_rub, s.code AS status_code
       FROM orders o
       JOIN order_statuses s ON s.id = o.status_id
       WHERE o.id = $1 AND o.user_id = $2
       FOR UPDATE OF o`,
      [orderId, userId]
    );
    if (orderRes.rows.length === 0) {
      throw new AppError('Заказ не найден', 404, 'NOT_FOUND');
    }
    const order = orderRes.rows[0];

    if (order.status_code !== 'new' && order.status_code !== 'awaiting_payment') {
      throw new AppError(
        `Заказ нельзя оплатить в статусе ${order.status_code}`,
        409,
        'CONFLICT'
      );
    }

    const statusRes = await client.query(
      `SELECT id, code FROM order_statuses WHERE code IN ('awaiting_payment', 'paid')`
    );
    const statusIds = {};
    for (const row of statusRes.rows) statusIds[row.code] = row.id;
    if (!statusIds.awaiting_payment || !statusIds.paid) {
      throw new AppError('Статусы заказа не найдены', 500, 'INTERNAL_ERROR');
    }

    // Триггер проверяет каждый переход отдельно, поэтому два UPDATE
    if (order.status_code === 'new') {
      await client.query(`UPDATE orders SET status_id = $1 WHERE id = $2`, [
        statusIds.awaiting_payment,
        orderId,
      ]);
    }
    await client.query(
      `UPDATE orders SET status_id = $1, paid_at = NOW() WHERE id = $2`,
      [statusIds.paid, orderId]
    );

    await client.query(
      `INSERT INTO payments (order_id, payment_method, status, amount_rub, external_id, paid_at)
       VALUES ($1, 'mock', 'success', $2, $3, NOW())`,
      [orderId, order.total_rub, `mock-${randomUUID()}`]
    );
  });

  return await getOrderById(orderId, userId, 'customer');
}