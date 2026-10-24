// Кэш списка товаров: версия + кэш по параметрам запроса.
import { createHash } from 'crypto';
import { redis, KEY_PREFIXES } from '../../config/redis.js';

const TTL_SECONDS = 120;
const VERSION_KEY = 'cache:products:version';

function log(...args) {
  console.log('[products.cache]', new Date().toISOString(), ...args);
}

/**
 * Увеличить версию кэша (инвалидация всего списка)
 * @returns {Promise<void>}
 */
export async function bumpProductsVersion() {
  try {
    const newVer = await redis.incr(VERSION_KEY);
    log('bumpProductsVersion ->', newVer);
  } catch (err) {
    console.error('Cache version bump error:', err.message);
  }
}

/**
 * Получить список товаров с кэшированием
 * @param {Object} params - Параметры запроса
 * @param {Function} loader - Функция загрузки данных из БД
 * @returns {Promise<{result: Object, hit: boolean}>}
 */
export async function cachedList(params, loader) {
  const {
    page = 1,
    limit = 20,
    marketplace = null,
    q = null,
    minPrice = null,
    maxPrice = null,
    sort = 'newest',
  } = params;

  try {
    // 1) Читаем текущую версию
    const version = (await redis.get(VERSION_KEY)) || '0';
    log('cachedList read version:', version);

    // 2) Формируем ключ кэша
    const raw = JSON.stringify([version, page, limit, marketplace ?? null, q ?? null, minPrice ?? null, maxPrice ?? null, sort ?? null]);
    const hash = createHash('sha1').update(raw).digest('hex');
    const key = KEY_PREFIXES.productsList(hash);
    log('cachedList key:', key);

    // 3) Пытаемся прочитать из кэша
    const cached = await redis.get(key);
    if (cached !== null) {
      log('cachedList HIT');
      return { result: JSON.parse(cached), hit: true };
    }
    log('cachedList MISS');
  } catch (err) {
    console.error('Cache read error:', err.message);
  }

  // 4) Кэш промахнулся — загружаем из БД
  const result = await loader();

  // 5) Записываем в кэш (ошибки только логируем)
  try {
    const version = (await redis.get(VERSION_KEY)) || '0';
    log('cachedList write version:', version);
    const raw = JSON.stringify([version, page, limit, marketplace ?? null, q ?? null, minPrice ?? null, maxPrice ?? null, sort ?? null]);
    const hash = createHash('sha1').update(raw).digest('hex');
    const key = KEY_PREFIXES.productsList(hash);
    log('cachedList write key:', key);
    await redis.set(key, JSON.stringify(result), 'EX', TTL_SECONDS);
  } catch (err) {
    console.error('Cache write error:', err.message);
  }

  return { result, hit: false };
}