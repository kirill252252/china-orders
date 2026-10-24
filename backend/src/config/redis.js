import Redis from 'ioredis';
import { config } from './index.js';

export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('🔴 Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

export async function healthCheck() {
  const result = await redis.ping();
  return result === 'PONG';
}

/**
 * Префиксы ключей Redis (не команда KEYS, а константы для генерации ключей).
 * Используйте SCAN вместо KEYS в продакшене для поиска ключей по паттерну.
 */
export const KEY_PREFIXES = {
  // refresh-токен по jti (идентификатор токена, а не userId)
  refreshToken: (jti) => `auth:refresh:${jti}`,
  // обратная связь jti -> userId (для отзыва по jti)
  jtiUser: (jti) => `auth:jti_user:${jti}`,
  // множество jti одного пользователя (для отзыва всех токенов пользователя)
  userJtiSet: (userId) => `auth:user_jti:${userId}`,
  rateLimit: (key) => `ratelimit:${key}`,
  exchangeRate: () => 'cache:exchange_rate:current',
  productsList: (hash) => `cache:products:list:${hash}`,
};