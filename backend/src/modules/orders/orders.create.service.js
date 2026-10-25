// Сервис заказов: создание заказа из корзины.
// Работает с БД через параметризованные запросы (pg Pool).
import { tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { getCart } from '../cart/cart.service.js';
import { randomInt } from 'crypto';

const ORDER_NUMBER_ATTEMPTS = 3;

/**
 * Генерирует номер заказа вида CN-YYYYMMDD-XXXXXX.
 */
function generateOrderNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CN-${datePart}-${randomInt(100000, 1000000)}`;
}

/**
 * Читает только что созданный заказ с позициями и адресом внутри транзакции.
 * Заметка менеджера в ответ покупателю не попадает.
 * @param {string} orderId
 * @param {object} client - pg Client
 */
async function readOrder(orderId, client) {
  const orderRes = await client.query(
    `SELECT o.id, o.order_number, o.subtotal_cny, o.exchange_rate_used, o.commission_percent,
            o.delivery_cost_rub, o.total_rub, o.customer_comment, o.created_at,
            s.code AS status_code, s.name_ru AS status_name,
            a.id AS address_id, a.type AS address_type, a.country, a.region, a.city,
            a.street, a.building, a.apartment, a.postal_code
     FROM orders o
     JOIN order_statuses s ON s.id = o.status_id
     LEFT JOIN addresses a ON a.id = o.shipping_address_id
     WHERE o.id = $1`,
    [orderId]
  );
  const o = orderRes.rows[0];

  const itemsRes = await client.query(
    `SELECT oi.product_id, p.name, oi.quantity, oi.selected_attributes, oi.price_cny, oi.weight_kg
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [orderId]
  );

  return {
    id: o.id,
    orderNumber: o.order_number,
    status: { code: o.status_code, nameRu: o.status_name },
    subtotalCny: Number(o.subtotal_cny),
    exchangeRate: Number(o.exchange_rate_used),
    commissionPercent: Number(o.commission_percent),
    deliveryCostRub: Number(o.delivery_cost_rub),
    totalRub: Number(o.total_rub),
    customerComment: o.customer_comment,
    createdAt: o.created_at,
    items: itemsRes.rows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      quantity: r.quantity,
      selectedAttributes: r.selected_attributes,
      priceCny: Number(r.price_cny),
      weightKg: Number(r.weight_kg),
    })),
    address: o.address_id
      ? {
          id: o.address_id,
          type: o.address_type,
          country: o.country,
          region: o.region,
          city: o.city,
          street: o.street,
          building: o.building,
          apartment: o.apartment,
          postalCode: o.postal_code,
        }
      : null,
  };
}

/**
 * Создаёт заказ из корзины пользователя.
 * Любая ошибка откатывает транзакцию: заказ не создаётся, корзина остаётся.
 * @param {number|string} userId - ID пользователя
 * @param {object} params - { addressId?, customerComment? }
 * @returns {Promise<object>} созданный заказ
 */
export async function createOrder(userId, { addressId, customerComment }) {
  return await tx(async (client) => {
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [String(userId)]);
    // Блокировка корзины защищает от двойной отправки
    const lockRes = await client.query(
      `SELECT id FROM carts WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    if (lockRes.rows.length === 0) {
      throw new AppError('Корзина пуста', 400, 'BAD_REQUEST');
    }
    const cartId = lockRes.rows[0].id;

    const cart = await getCart(userId, client);
    if (cart.items.length === 0) {
      throw new AppError('Корзина пуста', 400, 'BAD_REQUEST');
    }

    for (const item of cart.items) {
      if (!item.isActive) {
        throw new AppError(`Товар недоступен: ${item.name}`, 409, 'CONFLICT');
      }
    }

    let shippingAddressId = null;
    if (addressId) {
      const addrRes = await client.query(
        `SELECT id FROM addresses WHERE id = $1 AND user_id = $2`,
        [addressId, userId]
      );
      if (addrRes.rows.length === 0) {
        throw new AppError('Адрес не найден', 404, 'NOT_FOUND');
      }
      shippingAddressId = addrRes.rows[0].id;
    }

    const statusRes = await client.query(
      `SELECT id FROM order_statuses WHERE code = 'new'`
    );
    if (statusRes.rows.length === 0) {
      throw new AppError('Статус заказа не найден', 500, 'INTERNAL_ERROR');
    }
    const statusId = statusRes.rows[0].id;

    const rateRes = await client.query(
      `SELECT id FROM exchange_rates
       WHERE base_currency = 'CNY' AND target_currency = 'RUB'
         AND is_active AND valid_from <= NOW()
       ORDER BY valid_from DESC LIMIT 1`
    );
    if (rateRes.rows.length === 0) {
      throw new AppError('Не найден текущий курс CNY→RUB', 422, 'UNPROCESSABLE');
    }
    const exchangeRateId = rateRes.rows[0].id;

    const { exchangeRate, commissionPercent, tariffId } = cart.totals;

    // Вставка заказа сразу с номером; при коллизии номера пробуем новый
    // (ловить ошибку 23505 внутри транзакции нельзя, поэтому ON CONFLICT)
    let orderId = null;
    for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS && orderId === null; attempt++) {
      const orderRes = await client.query(
        `INSERT INTO orders (
           order_number, user_id, status_id, exchange_rate_id, delivery_tariff_id,
           exchange_rate_used, commission_percent, shipping_address_id, customer_comment
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (order_number) DO NOTHING
         RETURNING id`,
        [
          generateOrderNumber(),
          userId,
          statusId,
          exchangeRateId,
          tariffId,
          exchangeRate,
          commissionPercent,
          shippingAddressId,
          customerComment || null,
        ]
      );
      if (orderRes.rows.length > 0) {
        orderId = orderRes.rows[0].id;
      }
    }
    if (orderId === null) {
      throw new AppError('Не удалось создать номер заказа', 500, 'INTERNAL_ERROR');
    }

    // Цена фиксируется по price_cny_at_add (то, что видел покупатель)
    for (const item of cart.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, selected_attributes, price_cny, weight_kg)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
        [
          orderId,
          item.productId,
          item.quantity,
          JSON.stringify(item.selectedAttributes ?? {}),
          item.priceCnyAtAdd,
          item.weightKg,
        ]
      );
    }

    // Товары, попавшие в заказ, убираются из личного списка пользователя
    await client.query(
      `DELETE FROM user_products WHERE user_id = $1 AND product_id = ANY($2::bigint[])`,
      [userId, cart.items.map((item) => item.productId)]
    );

    await client.query(`SELECT fn_calculate_order_total($1)`, [orderId]);

    await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
    await client.query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);

    return await readOrder(orderId, client);
  });
}