// Статусы заказа: подписи и цвета бейджей (коды совпадают с order_statuses).
export const STATUSES = [
  { code: 'new', label: 'Новый', tone: 'yellow' },
  { code: 'awaiting_payment', label: 'Ожидает оплаты', tone: 'yellow' },
  { code: 'paid', label: 'Оплачен', tone: 'blue' },
  { code: 'purchased', label: 'Выкуплен', tone: 'blue' },
  { code: 'shipped_from_china', label: 'Отправлен из Китая', tone: 'blue' },
  { code: 'in_transit', label: 'В пути', tone: 'blue' },
  { code: 'arrived_warehouse', label: 'Прибыл на склад', tone: 'blue' },
  { code: 'delivered', label: 'Доставлен', tone: 'green' },
  { code: 'cancelled', label: 'Отменён', tone: 'red' },
];

export const STATUS_BY_CODE = Object.fromEntries(STATUSES.map((s) => [s.code, s]));