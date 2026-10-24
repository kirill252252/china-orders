// Сервис менеджера: отгрузка (трек, перевозчик, вес) и внутренний комментарий.
import { tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { getOrderById } from '../orders/orders.service.js';

// Отгрузку можно вести, начиная с выкупленного заказа
const SHIPMENT_STATUSES = [
  'purchased',
  'shipped_from_china',
  'in_transit',
  'arrived_warehouse',
  'delivered',
];

// Соответствие полей запроса колонкам таблицы shipments (имена колонок фиксированы здесь)
const COLUMNS = {
  trackingNumber: 'tracking_number',
  carrier: 'carrier',
  weightKg: 'weight_kg',
  estimatedArrival: 'estimated_arrival',
};

/**
 * Создаёт или обновляет единственную отгрузку заказа.
 * Обновляются только переданные поля.
 */
export async function upsertShipment(userId, role, orderId, data) {
  await tx(async (client) => {
    const orderRes = await client.query(
      `SELECT o.id, o.subtotal_cny, s.code AS status_code
       FROM orders o
       JOIN order_statuses s ON s.id = o.status_id
       WHERE o.id = $1
       FOR UPDATE OF o`,
      [orderId]
    );
    if (orderRes.rows.length === 0) {
      throw new AppError('Заказ не найден', 404, 'NOT_FOUND');
    }
    const order = orderRes.rows[0];
    if (!SHIPMENT_STATUSES.includes(order.status_code)) {
      throw new AppError(
        `Для заказа в статусе ${order.status_code} отгрузка недоступна`,
        409,
        'CONFLICT'
      );
    }

    const existing = await client.query(`SELECT id FROM shipments WHERE order_id = $1`, [orderId]);

    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO shipments
           (order_id, tracking_number, carrier, weight_kg, declared_value_cny, estimated_arrival)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          data.trackingNumber ?? null,
          data.carrier ?? null,
          data.weightKg ?? 0,
          order.subtotal_cny,
          data.estimatedArrival ?? null,
        ]
      );
      return;
    }

    const sets = [];
    const params = [];
    for (const [field, column] of Object.entries(COLUMNS)) {
      if (data[field] !== undefined) {
        params.push(data[field]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    params.push(orderId);
    await client.query(
      `UPDATE shipments SET ${sets.join(', ')} WHERE order_id = $${params.length}`,
      params
    );
  });

  return await getOrderById(orderId, userId, role);
}

/**
 * Записывает внутренний комментарий менеджера к заказу (клиенту не виден).
 */
export async function setManagerComment(userId, role, orderId, comment) {
  const res = await tx(async (client) =>
    client.query(`UPDATE orders SET manager_comment = $1 WHERE id = $2 RETURNING id`, [
      comment,
      orderId,
    ])
  );
  if (res.rows.length === 0) {
    throw new AppError('Заказ не найден', 404, 'NOT_FOUND');
  }
  return await getOrderById(orderId, userId, role);
}