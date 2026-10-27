// Сервис каталога товаров: список с фильтрами и пагинацией, один товар по импорту и ручному вводу.
// Работает с БД через параметризованные запросы (pg Pool).
import { query } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { getProvider } from '../../providers/index.js';
import crypto from 'crypto';

// Допустимые варианты сортировки — только ключи этого объекта подставляются в SQL.
const SORT_MAP = {
  newest: 'p.created_at DESC',
  price_asc: 'p.price_cny ASC',
  price_desc: 'p.price_cny DESC',
};

export async function listProducts({ page, limit, marketplace, q, minPrice, maxPrice, sort }) {
  const conditions = ['p.is_active = TRUE'];
  const params = [];
  let paramIdx = 1;

  if (marketplace) {
    params.push(marketplace);
    conditions.push(`m.code = $${paramIdx}`);
    paramIdx++;
  }

  if (q) {
    const escaped = q.replace(/[\\%_]/g, '\\$&');
    params.push(`%${escaped}%`);
    conditions.push(`p.name ILIKE $${paramIdx} ESCAPE '\\'`);
    paramIdx++;
  }

  if (minPrice !== undefined && minPrice !== null) {
    params.push(minPrice);
    conditions.push(`p.price_cny >= $${paramIdx}`);
    paramIdx++;
  }

  if (maxPrice !== undefined && maxPrice !== null) {
    params.push(maxPrice);
    conditions.push(`p.price_cny <= $${paramIdx}`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortSql = SORT_MAP[sort] || SORT_MAP.newest;

  // Общее количество для пагинации
  const countRes = await query(
    `SELECT COUNT(*) AS total FROM products p
     JOIN marketplaces m ON m.id = p.marketplace_id
     ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0].total, 10);

  const offset = (page - 1) * limit;
  params.push(limit);
  params.push(offset);

  const itemsRes = await query(
    `SELECT p.id, p.name, p.price_cny, p.weight_kg, p.main_image_url, p.external_id,
            m.code AS marketplace_code, m.name AS marketplace_name
     FROM products p
     JOIN marketplaces m ON m.id = p.marketplace_id
     ${whereClause}
     ORDER BY ${sortSql}
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    params
  );

  const items = itemsRes.rows.map(row => ({
    id: row.id,
    name: row.name,
    priceCny: Number(row.price_cny),
    weightKg: Number(row.weight_kg),
    mainImageUrl: row.main_image_url,
    marketplace: {
      code: row.marketplace_code,
      name: row.marketplace_name,
    },
    externalId: row.external_id,
  }));

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getProductById(id) {
  const userRes = await query(
    `SELECT p.id, p.name, p.description, p.price_cny, p.weight_kg, p.main_image_url, p.external_id,
            m.code AS marketplace_code, m.name AS marketplace_name
     FROM products p
     JOIN marketplaces m ON m.id = p.marketplace_id
     WHERE p.id = $1 AND p.is_active = TRUE`,
    [id]
  );
  const row = userRes.rows[0];
  if (!row) {
    throw AppError.notFound('Товар не найден');
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCny: Number(row.price_cny),
    weightKg: Number(row.weight_kg),
    mainImageUrl: row.main_image_url,
    marketplace: {
      code: row.marketplace_code,
      name: row.marketplace_name,
    },
    externalId: row.external_id,
  };
}

export async function importProduct(url, userId) {
  const provider = getProvider();
  const parsed = provider.parseUrl(url);
  if (!parsed) {
    const reason = typeof provider.explainFailure === 'function'
      ? provider.explainFailure(url)
      : 'Не удалось распознать ссылку';
    throw AppError.badRequest(reason);
  }

  // Находим marketplace_id по коду
  const marketplaceRes = await query(
    'SELECT id FROM marketplaces WHERE code = $1',
    [parsed.marketplace]
  );
  if (marketplaceRes.rows.length === 0) {
    throw AppError.badRequest('Маркетплейс не найден');
  }
  const marketplaceId = marketplaceRes.rows[0].id;

  // Проверяем, есть ли уже такой товар
  const existingRes = await query(
    `SELECT p.id FROM products p
     JOIN marketplaces m ON m.id = p.marketplace_id
     WHERE p.marketplace_id = $1 AND p.external_id = $2`,
    [marketplaceId, parsed.externalId]
  );
  if (existingRes.rows.length > 0) {
    const product = await getProductById(existingRes.rows[0].id);
    return { ...product, created: false };
  }

  // Запрашиваем демо-данные товара
  const productData = await provider.fetchProduct(parsed.marketplace, parsed.externalId);

  // Вставляем с ON CONFLICT DO NOTHING (защита от гонки запросов)
  const insertRes = await query(
    `INSERT INTO products (marketplace_id, external_id, name, description, price_cny, weight_kg, main_image_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     ON CONFLICT (marketplace_id, external_id) DO NOTHING
     RETURNING id`,
    [marketplaceId, parsed.externalId, productData.name, productData.description, productData.priceCny, productData.weightKg, productData.mainImageUrl]
  );

  if (insertRes.rows.length > 0) {
    const product = await getProductById(insertRes.rows[0].id);
    return { ...product, created: true };
  }

  // Гонка запросов — читаем существующий товар
  const existing2Res = await query(
    `SELECT p.id FROM products p
     JOIN marketplaces m ON m.id = p.marketplace_id
     WHERE p.marketplace_id = $1 AND p.external_id = $2`,
    [marketplaceId, parsed.externalId]
  );
  const row2 = existing2Res.rows[0];
  const product2 = await getProductById(row2.id);
  return { ...product2, created: false };
}

export async function createProductManual({ marketplace, name, priceCny, weightKg, description }) {
  // Проверяем, что маркетплейс существует
  const marketplaceRes = await query(
    'SELECT id FROM marketplaces WHERE code = $1',
    [marketplace]
  );
  if (marketplaceRes.rows.length === 0) {
    throw AppError.badRequest('Маркетплейс не найден');
  }
  const marketplaceId = marketplaceRes.rows[0].id;

  const externalId = 'manual-' + crypto.randomUUID();

  const insertRes = await query(
    `INSERT INTO products (marketplace_id, external_id, name, description, price_cny, weight_kg, main_image_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, TRUE)
     RETURNING id`,
    [marketplaceId, externalId, name, description, priceCny, weightKg]
  );

  return await getProductById(insertRes.rows[0].id);
}
