// Демо-провайдер: ссылки разбираются только по тексту, в сеть запросы не уходят.
// Данные товара генерируются детерминированно из (marketplace, externalId):
// одна и та же ссылка всегда даёт один и тот же товар.
import { MAX_URL_LENGTH } from './marketplace.provider.js';

// Идентификатор товара: только цифры, до 20 знаков
const ID_RE = /^\d{1,20}$/;

// Правила разбора по маркетплейсам. Хост сверяется точно (без подстрок),
// чтобы ссылки вида item.taobao.com.evil.com не принимались.
const RULES = [
  {
    marketplace: 'taobao',
    hosts: ['item.taobao.com', 'world.taobao.com'],
    extract: (u) => (u.pathname === '/item.htm' ? u.searchParams.get('id') : null),
  },
  {
    marketplace: 'tmall',
    hosts: ['detail.tmall.com', 'detail.tmall.hk'],
    extract: (u) => (u.pathname === '/item.htm' ? u.searchParams.get('id') : null),
  },
  {
    marketplace: '1688',
    hosts: ['detail.1688.com'],
    extract: (u) => u.pathname.match(/^\/offer\/(\d+)\.html$/)?.[1] ?? null,
  },
  {
    marketplace: 'pinduoduo',
    hosts: ['mobile.yangkeduo.com', 'yangkeduo.com', 'pinduoduo.com', 'mobile.pinduoduo.com'],
    extract: (u) => (/^\/goods2?\.html$/.test(u.pathname) ? u.searchParams.get('goods_id') : null),
  },
  {
    marketplace: 'jd',
    hosts: ['item.jd.com', 'item.m.jd.com'],
    extract: (u) => u.pathname.match(/^\/(?:product\/)?(\d+)\.html$/)?.[1] ?? null,
  },
  {
    marketplace: 'poizon',
    hosts: ['dewu.com', 'www.dewu.com', 'm.dewu.com', 'poizon.com', 'www.poizon.com'],
    extract: (u) => u.searchParams.get('spuId'),
  },
];

// Шаблоны названий для демо-товаров
const NAME_TEMPLATES = [
  'Кроссовки спортивные', 'Куртка зимняя', 'Рюкзак городской', 'Наушники беспроводные',
  'Умные часы', 'Чехол для телефона', 'Худи оверсайз', 'Настольная лампа',
  'Клавиатура механическая', 'Набор посуды', 'Сумка через плечо', 'Пауэрбанк 20000 мАч',
];

// Хеш FNV-1a: простая детерминированная функция, без внешних библиотек
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export class MockProvider {
  // Разбор ссылки без обращения к сети. Неизвестная ссылка даёт null.
  parseUrl(url) {
    if (typeof url !== 'string') return null;
    const raw = url.trim();
    if (raw.length === 0 || raw.length > MAX_URL_LENGTH) return null;

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    // Только http и https; ссылки с логином и паролем не принимаем
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;

    const host = parsed.hostname.toLowerCase();
    for (const rule of RULES) {
      if (!rule.hosts.includes(host)) continue;
      const id = rule.extract(parsed);
      if (id && ID_RE.test(id)) {
        return { marketplace: rule.marketplace, externalId: id };
      }
    }
    return null;
  }

  // Демо-данные товара: цена 15-3000 ¥, вес 0.1-5 кг, зависят только от входных данных
  async fetchProduct(marketplace, externalId) {
    if (!RULES.some((r) => r.marketplace === marketplace) || !ID_RE.test(String(externalId))) {
      throw new Error('Неизвестный маркетплейс или некорректный идентификатор товара');
    }
    const h = hash(`${marketplace}:${externalId}`);
    const h2 = hash(`${externalId}:${marketplace}:w`);
    const title = NAME_TEMPLATES[h % NAME_TEMPLATES.length];
    return {
      name: `${title} (${marketplace} №${externalId})`.slice(0, 200),
      priceCny: 15 + (h % 2986),
      weightKg: Math.round((0.1 + (h2 % 491) / 100) * 100) / 100,
      description: `Демо-товар «${title}», получен из MockProvider (маркетплейс ${marketplace}).`,
      mainImageUrl: null,
    };
  }
}
