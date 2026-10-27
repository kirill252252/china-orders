// Демо-провайдер: ссылки разбираются только по тексту, в сеть запросы не уходят.
// Данные товара генерируются детерминированно из (marketplace, externalId):
// одна и та же ссылка всегда даёт один и тот же товар.
import { MAX_URL_LENGTH } from './marketplace.provider.js';

// Идентификатор товара: только цифры, до 20 знаков
const ID_RE = /^\d{1,20}$/;

// Первая ссылка в тексте: приложения копируют адрес вместе с описанием товара
const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"'`，。！？【】（）]+/i;

// Вставленный текст может быть длиннее самой ссылки, но не безгранично
const MAX_TEXT_LENGTH = MAX_URL_LENGTH * 2;

// Домены коротких ссылок из мобильных приложений. Сервер по ним в сеть не ходит
// (риск SSRF): список нужен только для понятного сообщения пользователю.
const SHORT_HOSTS = ['dw4.co', 'e.tb.cn', 'm.tb.cn', 'tb.cn', 'u.jd.com', '3.cn'];

const MARKETPLACE_NAMES = {
  taobao: 'Taobao',
  tmall: 'Tmall',
  1688: '1688',
  pinduoduo: 'Pinduoduo',
  jd: 'JD',
  poizon: 'Poizon',
};

// Идентификатор из параметра id для заданных путей
const idParam = (...paths) => (u) => (paths.includes(u.pathname) ? u.searchParams.get('id') : null);

// Правила разбора по маркетплейсам. Хост сверяется точно (без подстрок),
// чтобы ссылки вида item.taobao.com.evil.com не принимались.
const RULES = [
  {
    marketplace: 'taobao',
    hosts: ['item.taobao.com', 'world.taobao.com', 'm.intl.taobao.com', 'h5.m.taobao.com'],
    extract: idParam('/item.htm', '/awp/core/detail.htm'),
  },
  {
    marketplace: 'tmall',
    hosts: ['detail.tmall.com', 'detail.tmall.hk', 'detail.m.tmall.com'],
    extract: idParam('/item.htm'),
  },
  {
    marketplace: '1688',
    hosts: ['detail.1688.com', 'm.1688.com'],
    extract: (u) => u.pathname.match(/^\/offer\/(\d+)\.html$/)?.[1] ?? null,
  },
  {
    marketplace: 'pinduoduo',
    hosts: ['mobile.yangkeduo.com', 'yangkeduo.com', 'pinduoduo.com', 'mobile.pinduoduo.com'],
    extract: (u) => (/^\/goods2?\.html$/.test(u.pathname) ? u.searchParams.get('goods_id') : null),
  },
  {
    marketplace: 'jd',
    hosts: ['item.jd.com', 'item.m.jd.com', 'm.jd.com'],
    extract: (u) => u.pathname.match(/^\/(?:product\/)?(\d+)\.html$/)?.[1] ?? null,
  },
  {
    marketplace: 'poizon',
    hosts: ['dewu.com', 'www.dewu.com', 'm.dewu.com', 'poizon.com', 'www.poizon.com'],
    // Параметр spuId или путь вида /product/<номер> (второй вариант нужно сверить с реальной ссылкой)
    extract: (u) => u.searchParams.get('spuId') ?? u.pathname.match(/^\/(?:product|goods)\/(\d+)(?:\.html)?$/)?.[1] ?? null,
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

// Достаёт первую ссылку из вставленного текста (или саму ссылку)
function extractUrl(input) {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (raw.length === 0 || raw.length > MAX_TEXT_LENGTH) return null;
  const match = raw.match(URL_IN_TEXT_RE);
  if (!match) return null;
  const url = match[0].replace(/[.,;:]+$/, '');
  return url.length <= MAX_URL_LENGTH ? url : null;
}

export class MockProvider {
  // Разбор ссылки без обращения к сети. Неизвестная ссылка даёт null.
  parseUrl(input) {
    const url = extractUrl(input);
    if (!url) return null;

    let parsed;
    try {
      parsed = new URL(url);
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

  // Причина, по которой ссылка не разобрана: текст для пользователя.
  // Вызывается только когда parseUrl вернул null; введённый адрес в ответ не подставляется.
  explainFailure(input) {
    const url = extractUrl(input);
    if (!url) return 'Не нашли ссылку. Вставьте адрес страницы товара, он начинается с https://';

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return 'Ссылка выглядит некорректно. Скопируйте адрес из адресной строки браузера.';
    }
    if (parsed.username || parsed.password) return 'Ссылки с логином и паролем не поддерживаются.';

    const host = parsed.hostname.toLowerCase();
    if (SHORT_HOSTS.includes(host)) {
      return 'Это короткая ссылка из приложения. Откройте товар в браузере, скопируйте полный адрес из адресной строки или заполните карточку вручную.';
    }
    const rule = RULES.find((r) => r.hosts.includes(host));
    if (rule) {
      return `Ссылка ведёт на ${MARKETPLACE_NAMES[rule.marketplace]}, но в ней нет номера товара. Откройте именно страницу товара и скопируйте её адрес.`;
    }
    return 'Эта площадка не поддерживается. Доступны Taobao, Tmall, 1688, Pinduoduo, JD и Poizon. Можно заполнить карточку вручную.';
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