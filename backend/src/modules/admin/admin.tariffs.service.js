// Сервис для работы с тарифами доставки (админка).
import { query, tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

/**
 * Маппинг строки БД в объект тарифа
 * @param {Object} row - Строка из БД
 * @returns {Object}
 */
export function mapTariff(row) {
  return {
    id: String(row.id),
    name: row.name,
    minWeightKg: Number(row.min_weight_kg),
    maxWeightKg: row.max_weight_kg !== null ? Number(row.max_weight_kg) : null,
    baseCostRub: Number(row.base_cost_rub),
    perKgCostRub: Number(row.per_kg_cost_rub),
    minDays: row.min_days,
    maxDays: row.max_days,
    isActive: row.is_active,
  };
}

/**
 * Получить список всех тарифов доставки
 * @returns {Promise<Array>}
 */
export async function listTariffs() {
  const result = await query(
    `SELECT id, name, min_weight_kg, max_weight_kg, base_cost_rub, per_kg_cost_rub, min_days, max_days, is_active
     FROM delivery_tariffs
     ORDER BY min_weight_kg, id`
  );

  return result.rows.map(mapTariff);
}

/**
 * Создать новый тариф доставки
 * @param {Object} data - Данные тарифа
 * @returns {Promise<Object>}
 */
async function createTariffInTx(data) {
  return await tx(async (client) => {
    // 1) Блокировка для предотвращения гонок
    await client.query('SELECT pg_advisory_xact_lock(7002)');

    // 2) Если isActive, проверка пересечения интервалов [min, max)
    if (data.isActive) {
      const conflictResult = await client.query(
        `SELECT id, name
         FROM delivery_tariffs
         WHERE is_active
           AND $1::numeric < COALESCE(max_weight_kg, 1000000)
           AND min_weight_kg < COALESCE($2::numeric, 1000000)
         LIMIT 1`,
        [data.minWeightKg, data.maxWeightKg]
      );

      if (conflictResult.rows.length > 0) {
        const conflict = conflictResult.rows[0];
        throw new AppError(`Интервал пересекается с тарифом ${conflict.name}`, 409, 'CONFLICT');
      }
    }

    // 3) Вставить новый тариф
    const result = await client.query(
      `INSERT INTO delivery_tariffs (name, min_weight_kg, max_weight_kg, base_cost_rub, per_kg_cost_rub, min_days, max_days, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, min_weight_kg, max_weight_kg, base_cost_rub, per_kg_cost_rub, min_days, max_days, is_active`,
      [data.name, data.minWeightKg, data.maxWeightKg, data.baseCostRub, data.perKgCostRub, data.minDays, data.maxDays, data.isActive]
    );

    return mapTariff(result.rows[0]);
  });
}

export async function createTariff(data) {
  try {
    return await createTariffInTx(data);
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Тариф с таким названием уже есть', 409, 'CONFLICT');
    }
    throw err;
  }
}

/**
 * Обновить тариф доставки
 * @param {string} id - ID тарифа
 * @param {Object} data - Данные для обновления
 * @returns {Promise<Object>}
 */
async function updateTariffInTx(id, data) {
  return await tx(async (client) => {
    // 1) Блокировка для предотвращения гонок
    await client.query('SELECT pg_advisory_xact_lock(7002)');

    // 2) Получить текущий тариф FOR UPDATE
    const currentResult = await client.query(
      `SELECT id, name, min_weight_kg, max_weight_kg, base_cost_rub, per_kg_cost_rub, min_days, max_days, is_active
       FROM delivery_tariffs
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (currentResult.rows.length === 0) {
      throw new AppError('Тариф не найден', 404, 'NOT_FOUND');
    }

    const current = currentResult.rows[0];

    // 3) Собрать итоговые значения
    const final = {
      name: data.name !== undefined ? data.name : current.name,
      minWeightKg: data.minWeightKg !== undefined ? data.minWeightKg : Number(current.min_weight_kg),
      maxWeightKg: data.maxWeightKg !== undefined ? data.maxWeightKg : (current.max_weight_kg !== null ? Number(current.max_weight_kg) : null),
      baseCostRub: data.baseCostRub !== undefined ? data.baseCostRub : Number(current.base_cost_rub),
      perKgCostRub: data.perKgCostRub !== undefined ? data.perKgCostRub : Number(current.per_kg_cost_rub),
      minDays: data.minDays !== undefined ? data.minDays : current.min_days,
      maxDays: data.maxDays !== undefined ? data.maxDays : current.max_days,
      isActive: data.isActive !== undefined ? data.isActive : current.is_active,
    };

    // 4) Валидация итоговых значений
    if (final.maxWeightKg !== null && final.maxWeightKg <= final.minWeightKg) {
      throw new AppError('maxWeightKg должен быть больше minWeightKg или null', 400, 'BAD_REQUEST');
    }
    if (final.maxDays < final.minDays) {
      throw new AppError('maxDays должен быть >= minDays', 400, 'BAD_REQUEST');
    }

    // 5) Проверка пересечения, если итоговый isActive = true
    if (final.isActive) {
      const conflictResult = await client.query(
        `SELECT id, name
         FROM delivery_tariffs
         WHERE is_active
           AND id <> $3
           AND $1::numeric < COALESCE(max_weight_kg, 1000000)
           AND min_weight_kg < COALESCE($2::numeric, 1000000)
         LIMIT 1`,
        [final.minWeightKg, final.maxWeightKg, id]
      );

      if (conflictResult.rows.length > 0) {
        const conflict = conflictResult.rows[0];
        throw new AppError(`Интервал пересекается с тарифом ${conflict.name}`, 409, 'CONFLICT');
      }
    }

    // 6) UPDATE только переданных полей
    const COLUMNS = {
      name: 'name',
      minWeightKg: 'min_weight_kg',
      maxWeightKg: 'max_weight_kg',
      baseCostRub: 'base_cost_rub',
      perKgCostRub: 'per_kg_cost_rub',
      minDays: 'min_days',
      maxDays: 'max_days',
      isActive: 'is_active',
    };

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, column] of Object.entries(COLUMNS)) {
      if (data[key] !== undefined) {
        updates.push(`${column} = $${paramIndex}`);
        values.push(data[key]);
        paramIndex++;
      }
    }

    if (updates.length > 0) {
      values.push(id);
      const result = await client.query(
        `UPDATE delivery_tariffs
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, min_weight_kg, max_weight_kg, base_cost_rub, per_kg_cost_rub, min_days, max_days, is_active`,
        values
      );
      return mapTariff(result.rows[0]);
    }

    // Если полей не передали (не должно случиться из-за валидации схемы), вернуть текущий
    return mapTariff(current);
  });
}

export async function updateTariff(id, data) {
  try {
    return await updateTariffInTx(id, data);
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Тариф с таким названием уже есть', 409, 'CONFLICT');
    }
    throw err;
  }
}