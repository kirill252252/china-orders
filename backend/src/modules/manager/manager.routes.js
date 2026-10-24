// Маршруты менеджера. Подключаются в app.js под /api/v1/manager.
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  managerListSchema,
  managerStatusSchema,
  managerShipmentSchema,
  managerCommentSchema,
} from './manager.schemas.js';
import { listOrders, changeStatus, updateShipment, updateComment } from './manager.controller.js';

const router = Router();
const staff = [requireAuth, requireRole('manager', 'admin')];

router.get('/orders', ...staff, validate(managerListSchema), listOrders);
router.patch('/orders/:id/status', ...staff, validate(managerStatusSchema), changeStatus);
router.patch('/orders/:id/shipment', ...staff, validate(managerShipmentSchema), updateShipment);
router.patch('/orders/:id/comment', ...staff, validate(managerCommentSchema), updateComment);

export default router;