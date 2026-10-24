// Сервис менеджера: очередь заказов и смена статуса.
// Пользователь передаётся в триггер истории через set_config (локально для транзакции).
import { query, tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { getOrderById } from '../orders/orders.service.js';

// Вручную нельзя выставлять: new создаётся системой, paid только через оплату
const MANUAL_FORBIDDEN = ['new', 'paid'];

function mapRow(r) {
  return {
    id: r.order_id,
    orderNumber: r.order_number,
    customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email },
    status: { code: r.status_code, nameRu: r.status_name },
    totalRub: Number(r.total_rub),
    itemsCount: Number(r.items_count),
    totalWeightKg: Number(r.total_weight_kg),
    managerComment: r.manager_comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Список заказов для менеджера.
 * Без status: очередь из вида v_manager_queue. Со status: прямой запрос по этому статусу.
 */
export async function listOrders({ page, limit, status }) {
  const offset = (page - 1) * limit;
  let rows;
  let total;

  if (!status) {
    const countRes = await query(`SELECT count(*) AS total FROM v_manager_queue`);
    total = Number(countRes.rows[0].total);
    const res = await query(
      `SELECT * FROM v_manager_queue
       ORDER BY status_sort_order, created_at, order_id
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    rows = res.rows;
  } else {
    const st = await query(`SELECT id FROM order_statuses WHERE code = $1`, [status]);
    if (st.rows.length === 0) {
      throw new AppError('Неизвестный статус', 400, 'BAD_REQUEST');
    }
    const countRes = await query(
      `SELECT count(*) AS total FROM orders WHERE status_id = $1`,
      [st.rows[0].id]
    );
    total = Number(countRes.rows[0].total);
    const res = await query(
      `SELECT o.id AS order_id, o.order_number,
              u.full_name AS customer_name, u.phone AS customer_phone, u.email AS customer_email,
              s.code AS status_code, s.name_ru AS status_name,
              o.total_rub, o.created_at, o.updated_at, o.manager_comment,
              (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
              (SELECT COALESCE(SUM(oi.quantity::numeric * oi.weight_kg), 0)
                 FROM order_items oi WHERE oi.order_id = o.id) AS total_weight_kg
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN order_statuses s ON s.id = o.status_id
       WHERE o.status_id = $1
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $2 OFFSET $3`,
      [st.rows[0].id, limit, offset]
    );
    rows = res.rows;
  }

  return {
    items: rows.map(mapRow),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Меняет статус заказа. Допустимость перехода проверяет триггер БД (код 23514).
 */
export async function changeOrderStatus(userId, role, orderId, { status, comment }) {
  if (MANUAL_FORBIDDEN.includes(status)) {
    throw new AppError('Этот статус нельзя выставить вручную', 409, 'CONFLICT');
  }
  const note = comment && comment.trim() ? comment.trim() : null;
  if (status === 'cancelled' && !note) {
    throw new AppError('Укажите причину отмены', 400, 'BAD_REQUEST');
  }

  try {
    await tx(async (client) => {
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [String(userId)]);

      const orderRes = await client.query(
        `SELECT o.id, s.code AS status_code
         FROM orders o
         JOIN order_statuses s ON s.id = o.status_id
         WHERE o.id = $1
         FOR UPDATE OF o`,
        [orderId]
      );
      if (orderRes.rows.length === 0) {
        throw new AppError('Заказ не найден', 404, 'NOT_FOUND');
      }

      const stRes = await client.query(`SELECT id FROM order_statuses WHERE code = $1`, [status]);
      if (stRes.rows.length === 0) {
        throw new AppError('Неизвестный статус', 400, 'BAD_REQUEST');
      }
      if (orderRes.rows[0].status_code === status) {
        throw new AppError('Заказ уже в этом статусе', 409, 'CONFLICT');
      }

      let sql = `UPDATE orders SET status_id = $1 WHERE id = $2`;
      if (status === 'cancelled') {
        sql = `UPDATE orders SET status_id = $1, cancelled_at = NOW() WHERE id = $2`;
      } else if (status === 'delivered') {
        sql = `UPDATE orders SET status_id = $1, completed_at = NOW() WHERE id = $2`;
      }
      await client.query(sql, [stRes.rows[0].id, orderId]);

      if (note) {
        await client.query(
          `UPDATE order_status_history SET comment = $1
           WHERE id = (SELECT max(id) FROM order_status_history WHERE order_id = $2)`,
          [note, orderId]
        );
      }
    });
  } catch (e) {
    // Триггер недопустимого перехода кидает check_violation
    if (e.code === '23514') {
      throw new AppError(e.message, 409, 'CONFLICT');
    }
    throw e;
  }

  return await getOrderById(orderId, userId, role);
}