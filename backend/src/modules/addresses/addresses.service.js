// Сервис адресов доставки. Операции изменения выполняются в транзакции
// с блокировкой строки пользователя, чтобы не нарушить единственный адрес по умолчанию.
import { query, tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

const MAX_ADDRESSES = 10;
const COLUMNS = `id, country, region, city, street, building, apartment, postal_code, is_default, created_at`;

function mapAddress(r) {
  return {
    id: r.id,
    country: r.country,
    region: r.region,
    city: r.city,
    street: r.street,
    building: r.building,
    apartment: r.apartment,
    postalCode: r.postal_code,
    isDefault: r.is_default,
    createdAt: r.created_at,
  };
}

async function readList(userId, run = query) {
  const res = await run(
    `SELECT ${COLUMNS} FROM addresses
     WHERE user_id = $1 AND type = 'delivery'
     ORDER BY is_default DESC, id DESC`,
    [userId]
  );
  return res.rows.map(mapAddress);
}

export async function listAddresses(userId) {
  return { items: await readList(userId) };
}

export async function createAddress(userId, data) {
  let createdId;
  try {
    createdId = await tx(async (client) => {
      await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
      const countRes = await client.query(
        `SELECT count(*)::int AS cnt FROM addresses WHERE user_id = $1 AND type = 'delivery'`,
        [userId]
      );
      const count = countRes.rows[0].cnt;
      if (count >= MAX_ADDRESSES) {
        throw new AppError(`Можно сохранить не более ${MAX_ADDRESSES} адресов`, 409, 'CONFLICT');
      }
      const makeDefault = Boolean(data.isDefault) || count === 0;
      if (makeDefault) {
        await client.query(`UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default`, [userId]);
      }
      const res = await client.query(
        `INSERT INTO addresses
           (user_id, type, country, region, city, street, building, apartment, postal_code, is_default)
         VALUES ($1, 'delivery', $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          userId,
          data.country,
          data.region || null,
          data.city,
          data.street,
          data.building,
          data.apartment || null,
          data.postalCode || null,
          makeDefault,
        ]
      );
      return res.rows[0].id;
    });
  } catch (e) {
    // Нарушение уникальности ловим снаружи транзакции
    if (e.code === '23505') {
      throw new AppError('Такой адрес уже сохранён', 409, 'CONFLICT');
    }
    throw e;
  }
  const items = await readList(userId);
  return { item: items.find((a) => a.id === String(createdId)), items };
}

export async function setDefaultAddress(userId, addressId) {
  await tx(async (client) => {
    await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const found = await client.query(
      `SELECT id FROM addresses WHERE id = $1 AND user_id = $2 AND type = 'delivery'`,
      [addressId, userId]
    );
    if (found.rows.length === 0) {
      throw new AppError('Адрес не найден', 404, 'NOT_FOUND');
    }
    await client.query(`UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default`, [userId]);
    await client.query(`UPDATE addresses SET is_default = true WHERE id = $1`, [addressId]);
  });
  return { items: await readList(userId) };
}

export async function deleteAddress(userId, addressId) {
  await tx(async (client) => {
    await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const found = await client.query(
      `SELECT id, is_default FROM addresses WHERE id = $1 AND user_id = $2 AND type = 'delivery'`,
      [addressId, userId]
    );
    if (found.rows.length === 0) {
      throw new AppError('Адрес не найден', 404, 'NOT_FOUND');
    }
    const used = await client.query(`SELECT 1 FROM orders WHERE shipping_address_id = $1 LIMIT 1`, [addressId]);
    if (used.rows.length > 0) {
      throw new AppError('Адрес используется в заказах и не может быть удалён', 409, 'CONFLICT');
    }
    await client.query(`DELETE FROM addresses WHERE id = $1`, [addressId]);
    if (found.rows[0].is_default) {
      await client.query(
        `UPDATE addresses SET is_default = true
         WHERE id = (SELECT id FROM addresses WHERE user_id = $1 AND type = 'delivery' ORDER BY id DESC LIMIT 1)`,
        [userId]
      );
    }
  });
  return { items: await readList(userId) };
}