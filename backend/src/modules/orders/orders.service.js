// Фасад сервиса заказов: сохраняет прежние импорты для контроллеров.
// Создание заказа и чтение разнесены по отдельным файлам.
export { createOrder } from './orders.create.service.js';
export { getOrders, getOrderById } from './orders.read.service.js';