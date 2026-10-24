// Профиль пользователя: изменение имени и телефона, смена пароля.
// После смены пароля все refresh-сессии пользователя завершаются.
import bcrypt from 'bcrypt';
import { query } from '../../config/db.js';
import { redis, KEY_PREFIXES } from '../../config/redis.js';
import { AppError } from '../../utils/errors.js';

async function readUser(userId) {
  const res = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [userId]
  );
  const r = res.rows[0];
  if (!r) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
  return { id: r.id, email: r.email, fullName: r.full_name, phone: r.phone, role: r.role };
}

export async function updateProfile(userId, { fullName, phone }) {
  const sets = [];
  const params = [];
  if (fullName !== undefined) {
    params.push(fullName);
    sets.push(`full_name = $${params.length}`);
  }
  if (phone !== undefined) {
    params.push(phone === '' ? null : phone);
    sets.push(`phone = $${params.length}`);
  }
  params.push(userId);
  const res = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  if (res.rowCount === 0) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
  return readUser(userId);
}

// Удаляет все refresh-сессии пользователя из Redis (ключи описаны в config/redis.js)
async function revokeAllSessions(userId) {
  const setKey = KEY_PREFIXES.userJtiSet(userId);
  const jtis = await redis.smembers(setKey);
  const keys = [setKey];
  for (const jti of jtis) keys.push(KEY_PREFIXES.refreshToken(jti), KEY_PREFIXES.jtiUser(jti));
  await redis.del(...keys);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const res = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  if (res.rowCount === 0) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');

  // Статус 400, а не 401: 401 запускает автообновление токена на клиенте
  const same = await bcrypt.compare(currentPassword, res.rows[0].password_hash);
  if (!same) throw new AppError('Текущий пароль указан неверно', 400, 'BAD_REQUEST');

  const hash = await bcrypt.hash(newPassword, 12);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, userId]);
  try {
    await revokeAllSessions(userId);
  } catch (err) {
    console.error('Не удалось завершить сессии после смены пароля:', err.message);
  }
  return { changed: true };
}