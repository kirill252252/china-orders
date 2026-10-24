// Работа с refresh-токенами в Redis (сессии).
// Ключ сессии — jti (идентификатор токена), а не userId, чтобы можно было отозвать
// отдельный токен, не трогая остальные устройства пользователя.
// Реализовано на ioredis (стек проекта), без посторонних библиотек.
import { redis, KEY_PREFIXES } from '../config/redis.js';
import { config } from '../config/index.js';

// Парсит строку TTL в секунды. Поддерживаемые форматы: "7d", "15m", "3600".
export function parseTtlToSeconds(value) {
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  const match = str.match(/^(\d+)([smhd]?)$/i);
  if (!match) return Number(str) || 0;
  const num = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 60 * 60;
    case 'd': return num * 24 * 60 * 60;
    default: return num; // без суффикса — секунды
  }
}

// TTL refresh-токена в секундах из переменной окружения JWT_REFRESH_TTL
export const REFRESH_TTL_SECONDS = parseTtlToSeconds(config.JWT_REFRESH_TTL);

// Сохранить refresh-токен (identifikтор jti) для пользователя.
export async function storeRefreshToken(userId, jti, ttlSeconds = REFRESH_TTL_SECONDS) {
  const multi = redis.multi();
  multi.setex(KEY_PREFIXES.refreshToken(jti), ttlSeconds, userId);
  multi.setex(KEY_PREFIXES.jtiUser(jti), ttlSeconds, userId);
  multi.sadd(KEY_PREFIXES.userJtiSet(userId), jti);
  multi.expire(KEY_PREFIXES.userJtiSet(userId), ttlSeconds);
  await multi.exec();
}

// Проверить, что refresh-токен с таким jti ещё не отозван и не истёк.
export async function isRefreshTokenValid(jti) {
  const value = await redis.get(KEY_PREFIXES.refreshToken(jti));
  return value !== null;
}

// Отозвать refresh-токен по jti (и убрать jti из множества пользователя).
export async function revokeRefreshToken(jti) {
  const userId = await redis.get(KEY_PREFIXES.jtiUser(jti));
  const multi = redis.multi();
  multi.del(KEY_PREFIXES.refreshToken(jti));
  multi.del(KEY_PREFIXES.jtiUser(jti));
  if (userId) multi.srem(KEY_PREFIXES.userJtiSet(userId), jti);
  await multi.exec();
}

// Отозвать все refresh-токены пользователя (выйти из всех устройств).
export async function revokeAllUserTokens(userId) {
  const jtis = await redis.smembers(KEY_PREFIXES.userJtiSet(userId));
  if (jtis.length === 0) return;
  const multi = redis.multi();
  for (const jti of jtis) {
    multi.del(KEY_PREFIXES.refreshToken(jti));
    multi.del(KEY_PREFIXES.jtiUser(jti));
  }
  multi.del(KEY_PREFIXES.userJtiSet(userId));
  await multi.exec();
}
