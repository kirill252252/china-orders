// Подписи свойств позиции для корзины и заказа.
import { getCategory } from './categories.js';

const BATTERY = { yes: 'есть', no: 'нет' };
const KNOWN = ['category', 'color', 'size', 'battery', 'note', 'link'];

// Список пар [подпись, значение]; ссылка выводится отдельно
export function attributeLines(attrs) {
  const a = attrs || {};
  const lines = [];
  if (a.category) lines.push(['Категория', getCategory(a.category)?.label || a.category]);
  if (a.color) lines.push(['Цвет', a.color]);
  if (a.size) lines.push(['Размер', a.size]);
  if (a.battery) lines.push(['Батарейка', BATTERY[a.battery] || a.battery]);
  if (a.note) lines.push(['Заметка', a.note]);
  // Старые заказы могут содержать произвольные ключи
  Object.entries(a).forEach(([key, value]) => {
    if (!KNOWN.includes(key)) lines.push([key, String(value)]);
  });
  return lines;
}

export const attributesText = (attrs) =>
  attributeLines(attrs)
    .map(([label, value]) => `${label}: ${value}`)
    .join(', ');