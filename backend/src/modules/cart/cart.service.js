// Сервис корзины: загрузка снимка корзины с расчётом стоимости, добавление,
// изменение и удаление позиций, очистка.
// Работает с БД через параметризованные запросы.
// Внутри транзакции все запросы идут через переданный client (исполнитель run).
// Расчёт стоимости делегируется в cart.pricing.js.
import { query, tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { calculateTotals } from './cart.pricing.js';
import { getCachedRate, fetchRateFromDb } from '../../utils/rateCache.js';

const MAX_QUANTITY = 99;

/**
 * Возвращает исполнитель запросов: транзакционный client или обычный query.
 * @param {object|null} client - pg Client внутри транзакции или null
 */
function getRunner(client) {
  return client ? (sql, params) => client.query(sql, params) : query;
}

/**
 * Находит корзину пользователя, создаёт её при отсутствии.
 * @returns {Promise<string>} id корзины
 */
async function getOrCreateCartId(userId, run) {
  await run(
    `INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const cartRes = await run(`SELECT id FROM carts WHERE user_id = $1`, [userId]);
  return cartRes.rows[0].id;
}

/**
 * Загружает снимок корзины пользователя с позициями.
 * Создаёт пустую корзину, если ещё не существует.
 * @param {number|string} userId - ID пользователя
 * @param {object} [client] - pg Client внутри транзакции (необязательно)
 * @returns {Promise<{cartId: string, items: Array}>}
 */
export async function loadCartSnapshot(userId, client = null) {
  const run = getRunner(client);
  const cartId = await getOrCreateCartId(userId, run);

  const itemsRes = await run(
    `SELECT ci.id, ci.product_id, ci.quantity, ci.selected_attributes, ci.price_cny_at_add,
            p.name, p.weight_kg, p.price_cny AS current_price_cny, p.main_image_url, p.is_active,
            m.code AS marketplace_code, m.name AS marketplace_name
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     JOIN marketplaces m ON m.id = p.marketplace_id
     WHERE ci.cart_id = $1
     ORDER BY ci.id`,
    [cartId]
  );

  return { cartId, items: itemsRes.rows };
}

/**
 * Возвращает корзину пользователя с рассчитанной стоимостью.
 * @param {number|string} userId
 * @param {object} [client] - pg Client внутри транзакции (необязательно)
 */
export async function getCart(userId, client = null) {
  const run = getRunner(client);
  const { items } = await loadCartSnapshot(userId, client);

  if (items.length === 0) {
    return {
      items: [],
      totals: {
        itemsRub: 0,
        totalWeightKg: 0,
        deliveryRub: 0,
        totalRub: 0,
        exchangeRate: 0,
        commissionPercent: 0,
        tariffId: null,
      },
    };
  }

  const exchangeRate = client ? await fetchRateFromDb(run) : await getCachedRate();

  const commissionRes = await run(
    `SELECT value FROM settings WHERE key = 'default_commission_percent'`
  );
  const commissionPercent = commissionRes.rows.length > 0
    ? Number(commissionRes.rows[0].value)
    : 0;

  const totalWeightKg = items.reduce(
    (sum, item) => sum + Number(item.weight_kg) * item.quantity,
    0
  );

  const tariffRes = await run(
    'SELECT fn_find_delivery_tariff($1) AS tariff_id',
    [totalWeightKg]
  );
  const tariffId = tariffRes.rows[0]?.tariff_id;
  if (!tariffId) {
    throw new AppError(
      `Не найден тариф доставки для веса ${totalWeightKg} кг`,
      422,
      'UNPROCESSABLE'
    );
  }

  const deliveryRes = await run(
    'SELECT fn_calculate_delivery_cost($1, $2) AS cost',
    [tariffId, totalWeightKg]
  );
  const deliveryRub = Number(deliveryRes.rows[0].cost);

  const itemsForPricing = items.map((item) => ({
    priceCny: Number(item.price_cny_at_add),
    quantity: item.quantity,
    weightKg: Number(item.weight_kg),
  }));

  const {
    itemsRub,
    totalWeightKg: calculatedWeight,
    deliveryRub: deliveryCost,
    totalRub,
    lineTotalsRub,
  } = calculateTotals(itemsForPricing, exchangeRate, commissionPercent, deliveryRub);

  return {
    items: items.map((item, index) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      mainImageUrl: item.main_image_url,
      marketplace: {
        code: item.marketplace_code,
        name: item.marketplace_name,
      },
      quantity: item.quantity,
      selectedAttributes: item.selected_attributes,
      priceCnyAtAdd: Number(item.price_cny_at_add),
      currentPriceCny: Number(item.current_price_cny),
      priceChanged: Number(item.price_cny_at_add) !== Number(item.current_price_cny),
      isActive: item.is_active,
      weightKg: Number(item.weight_kg),
      lineTotalRub: lineTotalsRub[index],
    })),
    totals: {
      itemsRub,
      totalWeightKg: calculatedWeight,
      deliveryRub: deliveryCost,
      totalRub,
      exchangeRate,
      commissionPercent,
      tariffId,
    },
  };
}

/**
 * Добавляет товар в корзину пользователя (атомарный upsert).
 * Повторное добавление той же позиции увеличивает количество.
 * @param {number|string} userId - ID пользователя
 * @param {object} params - { productId, quantity, selectedAttributes }
 * @returns {Promise<object>} обновлённая корзина
 */
export async function addItemToCart(userId, { productId, quantity, selectedAttributes }) {
  return await tx(async (client) => {
    const run = getRunner(client);

    const productRes = await run(
      `SELECT id, price_cny FROM products WHERE id = $1 AND is_active = true`,
      [productId]
    );
    if (productRes.rows.length === 0) {
      throw new AppError('Товар не найден', 404, 'NOT_FOUND');
    }
    const priceCnyAtAdd = Number(productRes.rows[0].price_cny);

    const cartId = await getOrCreateCartId(userId, run);

    const upsertRes = await run(
      `INSERT INTO cart_items (cart_id, product_id, quantity, selected_attributes, price_cny_at_add)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (cart_id, product_id, selected_attributes)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
       RETURNING quantity`,
      [cartId, productId, quantity, JSON.stringify(selectedAttributes ?? {}), priceCnyAtAdd]
    );
    // Исключение откатывает всю транзакцию, количество не изменится
    if (upsertRes.rows[0].quantity > MAX_QUANTITY) {
      throw new AppError(
        `Максимальное количество одной позиции: ${MAX_QUANTITY}`,
        400,
        'BAD_REQUEST'
      );
    }

    await run(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
    return await getCart(userId, client);
  });
}

/**
 * Находит позицию корзины, принадлежащую пользователю.
 * Чужая или несуществующая позиция даёт 404.
 * @returns {Promise<string>} id корзины
 */
async function findOwnedItemCartId(userId, itemId, run) {
  const res = await run(
    `SELECT ci.cart_id FROM cart_items ci
     JOIN carts c ON c.id = ci.cart_id
     WHERE ci.id = $1 AND c.user_id = $2`,
    [itemId, userId]
  );
  if (res.rows.length === 0) {
    throw new AppError('Позиция корзины не найдена', 404, 'NOT_FOUND');
  }
  return res.rows[0].cart_id;
}

/**
 * Обновляет количество позиции в корзине.
 * @param {number|string} userId - ID пользователя
 * @param {string} itemId - ID позиции корзины
 * @param {number} quantity - новое количество
 * @returns {Promise<object>} обновлённая корзина
 */
export async function updateItemInCart(userId, itemId, quantity) {
  return await tx(async (client) => {
    const run = getRunner(client);
    const cartId = await findOwnedItemCartId(userId, itemId, run);

    await run(
      `UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2`,
      [quantity, itemId]
    );
    await run(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
    return await getCart(userId, client);
  });
}

/**
 * Удаляет позицию из корзины.
 * @param {number|string} userId - ID пользователя
 * @param {string} itemId - ID позиции корзины
 * @returns {Promise<object>} обновлённая корзина
 */
export async function deleteItemFromCart(userId, itemId) {
  return await tx(async (client) => {
    const run = getRunner(client);
    const cartId = await findOwnedItemCartId(userId, itemId, run);

    await run(`DELETE FROM cart_items WHERE id = $1`, [itemId]);
    await run(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
    return await getCart(userId, client);
  });
}

/**
 * Очищает корзину пользователя.
 * @param {number|string} userId - ID пользователя
 * @returns {Promise<object>} пустая корзина
 */
export async function clearCart(userId) {
  return await tx(async (client) => {
    const run = getRunner(client);
    const cartId = await getOrCreateCartId(userId, run);

    await run(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
    await run(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
    return await getCart(userId, client);
  });
}