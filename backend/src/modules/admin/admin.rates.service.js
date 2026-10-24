// Сервис для работы с курсами валют (админка).
import { query, tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { invalidateRateCache } from '../../utils/rateCache.js';

/**
 * Получить текущий курс CNY -> RUB
 * @returns {Promise<{rate: number}>}
 */
export async function getCurrentRate() {
  const result = await query('SELECT fn_get_current_exchange_rate() AS rate');
  const rate = result.rows[0]?.rate;

  if (rate === null || rate === undefined) {
    throw new AppError('Курс не задан', 404, 'NOT_FOUND');
  }

  return { rate: Number(rate) };
}

/**
 * Получить список курсов CNY -> RUB с пагинацией
 * @param {Object} params - Параметры пагинации
 * @param {number} params.page - Номер страницы
 * @param {number} params.limit - Количество элементов на странице
 * @returns {Promise<{items: Array, page: number, limit: number, total: number, totalPages: number}>}
 */
export async function listRates({ page, limit }) {
  const offset = (page - 1) * limit;

  // Общее количество записей
  const countResult = await query(
    `SELECT COUNT(*) FROM exchange_rates WHERE base_currency = 'CNY' AND target_currency = 'RUB'`
  );
  const total = Number(countResult.rows[0].count);
  const totalPages = Math.ceil(total / limit);

  // Записи с пагинацией
  const dataResult = await query(
    `SELECT id, rate, source, is_active, valid_from, valid_until
     FROM exchange_rates
     WHERE base_currency = 'CNY' AND target_currency = 'RUB'
     ORDER BY valid_from DESC, id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const items = dataResult.rows.map((row) => ({
    id: String(row.id),
    rate: Number(row.rate),
    source: row.source,
    isActive: row.is_active,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
  }));

  return { items, page, limit, total, totalPages };
}

/**
 * Создать новый курс CNY -> RUB (деактивирует текущий активный)
 * @param {number} rate - Новый курс
 * @returns {Promise<{id: string, rate: number, source: string, isActive: boolean, validFrom: Date, validUntil: Date|null}>}
 */
export async function createRate(rate) {
  const result = await tx(async (client) => {
    // 1) Блокировка для предотвращения гонок
    await client.query('SELECT pg_advisory_xact_lock(7001)');

    // 2) Деактивировать текущий активный курс
    await client.query(
      `UPDATE exchange_rates
       SET is_active = false, valid_until = NOW()
       WHERE base_currency = 'CNY' AND target_currency = 'RUB' AND is_active`
    );

    // 3) Вставить новый активный курс
    const result = await client.query(
      `INSERT INTO exchange_rates (base_currency, target_currency, rate, source, is_active, valid_from)
       VALUES ('CNY', 'RUB', $1, 'manual', true, NOW())
       RETURNING id, rate, source, is_active, valid_from, valid_until`,
      [rate]
    );

    const row = result.rows[0];
    return {
      id: String(row.id),
      rate: Number(row.rate),
      source: row.source,
      isActive: row.is_active,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
    };
  });

  // Инвалидировать кэш курса после успешной транзакции
  await invalidateRateCache();

  return result;
}