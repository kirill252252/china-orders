// Выбор провайдера маркетплейсов.
// Сейчас всегда MockProvider. Чтобы подключить реальный источник данных,
// достаточно вернуть здесь другую реализацию интерфейса MarketplaceProvider.
import { MockProvider } from './mock.provider.js';

let instance = null;

export function getProvider() {
  if (!instance) instance = new MockProvider();
  return instance;
}
