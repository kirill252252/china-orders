// Маршруты аутентификации: регистрация, вход, профиль, refresh, logout, logout-all.
// Подключаются в app.js под префиксом /api/v1/auth.
import { Router } from 'express';
import { register, login, getMe, refresh, logout, logoutAll } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema } from './auth.schemas.js';
import { requireAuth } from '../../middleware/auth.js';
import { loginRateLimit } from '../../middleware/rateLimit.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', loginRateLimit, validate(loginSchema), login);
router.get('/me', requireAuth, getMe);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-all', requireAuth, logoutAll);

export default router;
