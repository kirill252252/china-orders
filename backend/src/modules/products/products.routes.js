// Маршруты каталога товаров: общий список, личный список, импорт и ручной ввод.
// Подключаются в app.js под префиксом /api/v1/products.
import { Router } from 'express';
import {
  listProducts,
  getProduct,
  importProduct,
  createProductManual,
  listMine,
  removeMine,
} from './products.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { importRateLimit } from '../../middleware/rateLimit.js';
import {
  productListSchema,
  productIdSchema,
  importSchema,
  manualProductSchema,
  mineIdSchema,
} from './products.schemas.js';

const router = Router();

router.get('/', validate(productListSchema), listProducts);
router.get('/mine', requireAuth, validate(productListSchema), listMine);
router.delete('/mine/:id', requireAuth, validate(mineIdSchema), removeMine);
router.post('/import', importRateLimit, requireAuth, validate(importSchema), importProduct);
router.post('/manual', requireAuth, validate(manualProductSchema), createProductManual);
router.get('/:id', validate(productIdSchema), getProduct);

export default router;