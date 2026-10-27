// Категории товаров и уровни ограничений перевозки. Временно хранятся в коде.
export const LEVEL_LABEL = { ok: 'Можно заказывать', limited: 'Принимаем по условиям доставки' };

export const CATEGORIES = [
  { code: 'clothes', label: 'Одежда', level: 'ok' },
  { code: 'shoes', label: 'Обувь', level: 'ok' },
  { code: 'bags', label: 'Сумки и аксессуары', level: 'ok' },
  { code: 'home', label: 'Товары для дома', level: 'ok' },
  { code: 'toys', label: 'Игрушки', level: 'ok' },
  { code: 'sport', label: 'Спорт и отдых', level: 'ok' },
  { code: 'other', label: 'Другое (опишите в заметке)', level: 'ok' },
  { code: 'electronics', label: 'Электроника с аккумулятором', level: 'limited', hint: 'Принимаем по условиям линии доставки, менеджер подтвердит перед выкупом.' },
  { code: 'powerbank', label: 'Пауэрбанки и отдельные аккумуляторы', level: 'limited', hint: 'Принимаем только если линия доставки их допускает. Менеджер сообщит до выкупа.' },
  { code: 'cosmetics', label: 'Косметика, парфюмерия, жидкости', level: 'limited', hint: 'Жидкости, кремы и порошки принимаем по условиям линии доставки.' },
  { code: 'food', label: 'Продукты питания и БАДы', level: 'limited', hint: 'Принимаем по условиям линии доставки.' },
  { code: 'medical', label: 'Лекарства и медицинские изделия', level: 'limited', hint: 'Нужно уточнение у менеджера.' },
  { code: 'knives', label: 'Ножи и режущие инструменты', level: 'limited', hint: 'Принимаем по условиям перевозчика.' },
  { code: 'brand', label: 'Брендовые товары', level: 'limited', hint: 'Риск задержки или изъятия на таможне.' },
];

export const getCategory = (code) => CATEGORIES.find((c) => c.code === code) || null;

// Итоговый уровень: обычная категория с аккумулятором становится «по условиям»
export function assess(code, battery) {
  const cat = getCategory(code);
  if (!cat) return null;
  if (cat.level === 'ok' && battery === 'yes') {
    return { level: 'limited', hint: 'Товары с аккумулятором принимаем по условиям линии доставки, менеджер подтвердит перед выкупом.' };
  }
  return { level: cat.level, hint: cat.hint || '' };
}

// Слова, по которым название товара похоже на запрещённый или ограниченный товар.
// Совпадение целого слова или начала слова; только предупреждение, заказ не блокируется.
const EXACT = ['нож', 'ножи', 'ножа', 'ножей', 'ножом', 'ножик', 'ножики', 'кинжал', 'vape', 'pistol', 'knife', 'weapon'];
const STEMS = ['пистолет', 'ружь', 'оружи', 'боеприпас', 'взрывч', 'пиротех', 'фейерверк', 'петард', 'вейп', 'сигарет', 'наркот', 'шокер', 'травмат', 'нунчак', 'арбалет'];

export function nameWarning(name) {
  const words = String(name || '').toLowerCase().split(/[^a-zа-яё0-9]+/).filter(Boolean);
  return words.some((w) => EXACT.includes(w) || STEMS.some((s) => w.startsWith(s)));
}