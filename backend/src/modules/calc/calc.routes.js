// Маршрут калькулятора (публичный, с ограничением частоты). Подключается под /api/v1/calc.
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { calcSchema } from './calc.schemas.js';
import { calculate } from './calc.controller.js';

const router = Router();
const calcRateLimit = rateLimit({ max: 120, windowMs: 60000, keyPrefix: 'calc' });

router.get('/', calcRateLimit, validate(calcSchema), calculate);

export default router;