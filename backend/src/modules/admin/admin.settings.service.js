// Сервис для работы с настройками (админка).
import { query } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

/**
 * Получить текущую комиссию по умолчанию
 * @returns {Promise<{commissionPercent: number}>}
 */
export async function getCommission() {
  const result = await query(
    `SELECT value FROM settings WHERE key = 'default_commission_percent'`
  );

  if (result.rows.length === 0) {
    throw new AppError('Комиссия не задана', 404, 'NOT_FOUND');
  }

  return { commissionPercent: Number(result.rows[0].value) };
}

/**
 * Установить комиссию по умолчанию
 * @param {number} percent - Процент комиссии
 * @returns {Promise<{commissionPercent: number}>}
 */
export async function setCommission(percent) {
  await query(
    `INSERT INTO settings (key, value) VALUES ('default_commission_percent', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(percent)]
  );

  return { commissionPercent: percent };
}