// Ограничение частоты запросов: скользящее окно на sorted set в Redis.
// Ошибка лимита передаётся через next(err): throw в async-middleware Express 4 не ловит.
import { redis, KEY_PREFIXES } from '../config/redis.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';

export function rateLimit({ max, windowMs, keyPrefix = 'api' }) {
  return async (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = KEY_PREFIXES.rateLimit(`${keyPrefix}:${ip}`);
    const now = Date.now();

    let count;
    try {
      const results = await redis
        .multi()
        .zremrangebyscore(key, 0, now - windowMs)
        .zadd(key, now, `${now}-${Math.random()}`)
        .zcard(key)
        .pexpire(key, windowMs)
        .exec();
      count = results[2][1];
    } catch (err) {
      // Redis недоступен: не блокируем пользователей из-за сбоя ограничителя
      console.error('Rate limit error:', err.message);
      return next();
    }

    res.set({
      'X-RateLimit-Limit': String(max),
      'X-RateLimit-Remaining': String(Math.max(0, max - count)),
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
    });

    if (count > max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return next(new AppError('Слишком много запросов. Повторите позже.', 429, 'TOO_MANY_REQUESTS'));
    }
    return next();
  };
}

export const loginRateLimit = rateLimit({
  max: Number(config.RATE_LIMIT_LOGIN_MAX ?? 10),
  windowMs: Number(config.RATE_LIMIT_LOGIN_WINDOW_MS ?? 900000),
  keyPrefix: 'login',
});

export const importRateLimit = rateLimit({
  max: Number(config.RATE_LIMIT_IMPORT_MAX ?? 20),
  windowMs: Number(config.RATE_LIMIT_IMPORT_WINDOW_MS ?? 60000),
  keyPrefix: 'import',
});

export const orderRateLimit = rateLimit({
  max: 30,
  windowMs: 60000,
  keyPrefix: 'order',
});