// Кэш курса валют: чтение из Redis, фоллбэк в БД, инвалидация.
import { redis, KEY_PREFIXES } from '../config/redis.js';
import { query } from '../config/db.js';
import { AppError } from './errors.js';

const TTL_SECONDS = 3600;

/**
 * Получить курс из БД
 * @param {Function} run - Функция выполнения запроса (по умолчанию query)
 * @returns {Promise<number>}
 */
export async function fetchRateFromDb(run = query) {
  const result = await run('SELECT fn_get_current_exchange_rate() AS rate');
  const rate = result.rows[0]?.rate;

  if (rate === null || rate === undefined) {
    throw new AppError('Не найден текущий курс CNY→RUB', 422, 'UNPROCESSABLE');
  }

  return Number(rate);
}

/**
 * Получить курс с кэшированием в Redis
 * @returns {Promise<number>}
 */
export async function getCachedRate() {
  const key = KEY_PREFIXES.exchangeRate();

  // 1) Попытка прочитать из Redis
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return Number(cached);
    }
  } catch (err) {
    console.error('Rate cache read error:', err.message);
  }

  // 2) Фоллбэк в БД
  const rate = await fetchRateFromDb();

  // 3) Записать в Redis (не критично, если не вышло)
  try {
    await redis.set(key, String(rate), 'EX', TTL_SECONDS);
  } catch (err) {
    console.error('Rate cache write error:', err.message);
  }

  return rate;
}

/**
 * Инвалидировать кэш курса
 * @returns {Promise<void>}
 */
export async function invalidateRateCache() {
  const key = KEY_PREFIXES.exchangeRate();
  try {
    await redis.del(key);
  } catch (err) {
    console.error('Rate cache invalidate error:', err.message);
  }
}