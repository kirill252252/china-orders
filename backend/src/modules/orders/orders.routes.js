// Маршруты заказов: создание и получение.
// Подключаются в app.js под префиксом /api/v1/orders.
import { Router } from 'express';
import { createOrder, getOrders, getOrder, pay } from './orders.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { orderCreateSchema, ordersListSchema, orderIdSchema, orderPaySchema } from './orders.schemas.js';
import { orderRateLimit } from '../../middleware/rateLimit.js';

const router = Router();

router.post('/', orderRateLimit, requireAuth, requireRole('customer'), validate(orderCreateSchema), createOrder);
router.post('/:id/pay', requireAuth, requireRole('customer'), validate(orderPaySchema), pay);
router.get('/', requireAuth, requireRole('customer'), validate(ordersListSchema), getOrders);
router.get('/:id', requireAuth, validate(orderIdSchema), getOrder);

export default router;
