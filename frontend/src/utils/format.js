// Форматирование денег, веса и дат для интерфейса.
const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });

export const formatRub = (n) => rub.format(Number(n) || 0);
export const formatCny = (n) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(n) || 0)} ¥`;
export const formatKg = (n) => `${num.format(Number(n) || 0)} кг`;
export const formatNumber = (n) => num.format(Number(n) || 0);

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}