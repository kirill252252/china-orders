// Личный список товаров пользователя: добавление, просмотр, удаление.
// Строка products удаляется только когда на неё не осталось ссылок.
import { query } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

const SORTS = {
  newest: 'up.created_at DESC, p.id DESC',
  price_asc: 'p.price_cny ASC, p.id DESC',
  price_desc: 'p.price_cny DESC, p.id DESC',
};

/** Добавляет товар в список; повторное добавление поднимает его наверх. */
export async function addToMine(userId, productId) {
  await query(
    `INSERT INTO user_products (user_id, product_id) VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO UPDATE SET created_at = NOW()`,
    [userId, productId]
  );
}

/** Список товаров пользователя с теми же фильтрами, что в общем каталоге. */
export async function listMine(userId, { page, limit, marketplace, q, minPrice, maxPrice, sort }) {
  const conditions = ['up.user_id = $1', 'p.is_active = TRUE'];
  const params = [userId];

  if (marketplace) {
    params.push(marketplace);
    conditions.push(`m.code = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    conditions.push(`p.name ILIKE $${params.length} ESCAPE '\\'`);
  }
  if (minPrice !== undefined && minPrice !== null) {
    params.push(minPrice);
    conditions.push(`p.price_cny >= $${params.length}`);
  }
  if (maxPrice !== undefined && maxPrice !== null) {
    params.push(maxPrice);
    conditions.push(`p.price_cny <= $${params.length}`);
  }

  const from = `FROM user_products up
     JOIN products p ON p.id = up.product_id
     JOIN marketplaces m ON m.id = p.marketplace_id`;
  const where = `WHERE ${conditions.join(' AND ')}`;

  const countRes = await query(`SELECT COUNT(*) AS total ${from} ${where}`, params);
  const total = Number(countRes.rows[0].total);

  const itemsRes = await query(
    `SELECT p.id, p.name, p.price_cny, p.weight_kg, p.main_image_url, p.external_id,
            m.code AS marketplace_code, m.name AS marketplace_name
     ${from} ${where}
     ORDER BY ${SORTS[sort] || SORTS.newest}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  return {
    items: itemsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      priceCny: Number(r.price_cny),
      weightKg: Number(r.weight_kg),
      mainImageUrl: r.main_image_url,
      marketplace: { code: r.marketplace_code, name: r.marketplace_name },
      externalId: r.external_id,
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/** Убирает товар из списка пользователя. */
export async function removeFromMine(userId, productId) {
  const res = await query(
    `DELETE FROM user_products
     WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );

  if (res.rowCount === 0) {
    throw new AppError('Товар не найден в вашем списке', 404, 'NOT_FOUND');
  }

  return { id: String(productId) };
}