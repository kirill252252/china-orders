// Маршруты профиля. Подключаются в app.js под /api/v1/profile.
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { updateProfileSchema, changePasswordSchema } from './profile.schemas.js';
import { updateProfile, changePassword } from './profile.controller.js';

const router = Router();
const passwordRateLimit = rateLimit({ max: 20, windowMs: 15 * 60 * 1000, keyPrefix: 'password' });

router.patch('/', requireAuth, validate(updateProfileSchema), updateProfile);
router.post('/password', passwordRateLimit, requireAuth, validate(changePasswordSchema), changePassword);

export default router;