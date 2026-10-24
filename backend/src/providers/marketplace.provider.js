// Интерфейс провайдера маркетплейса (точка расширения).
//
// Чтобы подключить реальный источник данных (официальный API, партнёрский
// сервис), нужно реализовать класс с двумя методами ниже и вернуть его
// из getProvider() в providers/index.js. Остальной код проекта от
// конкретной реализации не зависит.
//
// В курсовой работе реальный парсинг и скрейпинг маркетплейсов не делается:
// используется MockProvider с демо-данными.

/**
 * @typedef {Object} ParsedUrl
 * @property {string} marketplace  Код маркетплейса, как в таблице marketplaces.code
 * @property {string} externalId   Идентификатор товара на самом маркетплейсе
 */

/**
 * @typedef {Object} ProductData
 * @property {string} name
 * @property {number} priceCny
 * @property {number} weightKg
 * @property {string} description
 * @property {string|null} mainImageUrl
 */

/**
 * @typedef {Object} MarketplaceProvider
 * @property {(url: string) => ParsedUrl|null} parseUrl
 *   Разбирает ссылку без обращения к сети. Для неизвестной или небезопасной
 *   ссылки возвращает null.
 * @property {(marketplace: string, externalId: string) => Promise<ProductData>} fetchProduct
 *   Возвращает данные товара. Бросает ошибку, если товар получить нельзя.
 */

// Максимальная длина ссылки, которую принимаем на разбор
export const MAX_URL_LENGTH = 2048;

// Проверка, что объект соответствует интерфейсу провайдера
export function isMarketplaceProvider(obj) {
  return Boolean(obj)
    && typeof obj.parseUrl === 'function'
    && typeof obj.fetchProduct === 'function';
}
