// Чистая функция расчёта стоимости корзины.
// Без обращений к БД. Деньги считаются в целых копейках, возвращаются в рублях с 2 знаками.

/**
 * @param {Array<{priceCny: number, quantity: number, weightKg: number}>} items
 * @param {number} rate - курс CNY→RUB
 * @param {number} commissionPercent - комиссия в процентах
 * @param {number} deliveryRub - стоимость доставки в рублях
 * @returns {{itemsRub: number, totalWeightKg: number, deliveryRub: number, totalRub: number, lineTotalsRub: number[]}}
 */
export function calculateTotals(items, rate, commissionPercent, deliveryRub) {
  const lineTotalsRub = [];
  let itemsRubKopecks = 0;
  let totalWeightKg = 0;

  for (const item of items) {
    const lineKopecks = Math.round(item.priceCny * 100 * item.quantity * rate * (1 + commissionPercent / 100));
    const lineRub = lineKopecks / 100;
    lineTotalsRub.push(lineRub);
    itemsRubKopecks += lineKopecks;
    totalWeightKg += item.weightKg * item.quantity;
  }

  const itemsRub = Math.round(itemsRubKopecks / 100 * 100) / 100;
  const totalRub = Math.round((itemsRubKopecks / 100 + deliveryRub) * 100) / 100;

  return {
    itemsRub,
    totalWeightKg,
    deliveryRub,
    totalRub,
    lineTotalsRub,
  };
}
