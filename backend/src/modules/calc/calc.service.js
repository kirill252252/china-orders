// Калькулятор стоимости: та же формула, что в корзине и заказе.
// Курс берётся из кэша, комиссия из settings, доставка из функций БД.
import { query } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { getCachedRate } from '../../utils/rateCache.js';
import { calculateTotals } from '../cart/cart.pricing.js';

const round2 = (n) => Math.round(n * 100) / 100;

export async function calculate({ priceCny, quantity, weightKg }) {
  const exchangeRate = await getCachedRate();

  const commissionRes = await query(
    `SELECT value FROM settings WHERE key = 'default_commission_percent'`
  );
  const commissionPercent = commissionRes.rows.length > 0 ? Number(commissionRes.rows[0].value) : 0;

  const totalWeightKg = weightKg * quantity;
  const tariffRes = await query('SELECT fn_find_delivery_tariff($1) AS tariff_id', [totalWeightKg]);
  const tariffId = tariffRes.rows[0]?.tariff_id;
  if (!tariffId) {
    throw new AppError(`Не найден тариф доставки для веса ${totalWeightKg} кг`, 422, 'UNPROCESSABLE');
  }
  const deliveryRes = await query('SELECT fn_calculate_delivery_cost($1, $2) AS cost', [tariffId, totalWeightKg]);
  const deliveryRub = Number(deliveryRes.rows[0].cost);

  const totals = calculateTotals([{ priceCny, quantity, weightKg }], exchangeRate, commissionPercent, deliveryRub);
  const goodsRub = round2(priceCny * quantity * exchangeRate);

  return {
    priceCny,
    quantity,
    goodsCny: round2(priceCny * quantity),
    exchangeRate,
    commissionPercent,
    goodsRub,
    commissionRub: round2(totals.itemsRub - goodsRub),
    itemsRub: totals.itemsRub,
    totalWeightKg: totals.totalWeightKg,
    deliveryRub: totals.deliveryRub,
    totalRub: totals.totalRub,
    tariffId,
  };
}