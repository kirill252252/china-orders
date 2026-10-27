// Разбор ссылки только на стороне браузера: площадка угадывается по домену, на сервер уходит адрес как есть.
const DOMAINS = [
  ['taobao', ['taobao.com']],
  ['tmall', ['tmall.com', 'tmall.hk']],
  ['1688', ['1688.com']],
  ['pinduoduo', ['yangkeduo.com', 'pinduoduo.com']],
  ['jd', ['jd.com']],
  ['poizon', ['dewu.com', 'poizon.com']],
];

const URL_RE = /https?:\/\/[^\s<>"'`，。！？【】（）]+/i;

// Первая ссылка из вставленного текста (приложения копируют адрес вместе с описанием)
export function extractLink(text) {
  const match = String(text || '').match(URL_RE);
  return match ? match[0].replace(/[.,;:]+$/, '') : '';
}

// Адрес только с http/https и без логина с паролем, иначе пустая строка
export function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const okProtocol = url.protocol === 'http:' || url.protocol === 'https:';
    return okProtocol && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function guessMarketplace(text) {
  const href = safeHttpUrl(extractLink(text));
  if (!href) return '';
  const host = new URL(href).hostname.toLowerCase();
  for (const [code, domains] of DOMAINS) {
    if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return code;
  }
  return '';
}