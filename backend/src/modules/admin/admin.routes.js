// Маршруты админки. Подключаются в app.js под /api/v1/admin.
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { getCurrentRate, listRates, createRate, getCommission, updateCommission, listTariffs, createTariff, updateTariff, listUsers, updateUser, getStats } from './admin.controller.js';
import { listRatesSchema, createRateSchema, updateCommissionSchema, createTariffSchema, updateTariffSchema, listUsersSchema, updateUserSchema, statsSchema } from './admin.schemas.js';
import { guardAdminChanges, getAccess } from './admin.access.js';

const router = Router();

const adminOnly = [requireAuth, requireRole('admin')];

/**
 * @route GET /api/v1/admin/rates
 * @description Получить список курсов CNY -> RUB с пагинацией
 * @access Admin
 */
router.get('/rates', ...adminOnly, validate(listRatesSchema), listRates);

/**
 * @route POST /api/v1/admin/rates
 * @description Создать новый курс CNY -> RUB (деактивирует текущий)
 * @access Admin
 */
router.post('/rates', ...adminOnly, validate(createRateSchema), createRate);

/**
 * @route GET /api/v1/admin/rates/current
 * @description Получить текущий курс CNY -> RUB
 * @access Admin
 */
router.get('/rates/current', ...adminOnly, getCurrentRate);

/**
 * @route GET /api/v1/admin/settings/commission
 * @description Получить текущую комиссию по умолчанию
 * @access Admin
 */
router.get('/settings/commission', ...adminOnly, getCommission);

/**
 * @route PUT /api/v1/admin/settings/commission
 * @description Установить комиссию по умолчанию
 * @access Admin
 */
router.put('/settings/commission', ...adminOnly, validate(updateCommissionSchema), updateCommission);

/**
 * @route GET /api/v1/admin/tariffs
 * @description Получить список тарифов доставки
 * @access Admin
 */
router.get('/tariffs', ...adminOnly, listTariffs);

/**
 * @route POST /api/v1/admin/tariffs
 * @description Создать новый тариф доставки
 * @access Admin
 */
router.post('/tariffs', ...adminOnly, validate(createTariffSchema), createTariff);

/**
 * @route PATCH /api/v1/admin/tariffs/:id
 * @description Обновить тариф доставки
 * @access Admin
 */
router.patch('/users/:id', ...adminOnly, validate(updateUserSchema), guardAdminChanges, updateUser);
router.get('/access', ...adminOnly, getAccess);

/**
 * @route GET /api/v1/admin/users
 * @description Получить список пользователей с пагинацией и фильтрами
 * @access Admin
 */
router.get('/users', ...adminOnly, validate(listUsersSchema), listUsers);

/**
 * @route PATCH /api/v1/admin/users/:id
 * @description Обновить пользователя (роль и/или активность)
 * @access Admin
 */
router.patch('/users/:id', ...adminOnly, validate(updateUserSchema), updateUser);

/**
 * @route GET /api/v1/admin/stats
 * @description Получить статистику за период
 * @access Admin
 */
router.get('/stats', ...adminOnly, validate(statsSchema), getStats);

export default router;