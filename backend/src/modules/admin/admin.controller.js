// Контроллер админки: курсы, настройки, пользователи, статистика.
import * as ratesService from './admin.rates.service.js';
import * as settingsService from './admin.settings.service.js';
import * as tariffsService from './admin.tariffs.service.js';
import * as usersService from './admin.users.service.js';
import * as statsService from './admin.stats.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * GET /api/v1/admin/rates/current
 * Получить текущий курс валют
 */
export const getCurrentRate = asyncHandler(async (req, res) => {
  const data = await ratesService.getCurrentRate();
  res.json({ success: true, data });
});

/**
 * GET /api/v1/admin/rates
 * Получить список курсов CNY -> RUB с пагинацией
 */
export const listRates = asyncHandler(async (req, res) => {
  const { page, limit } = req.validated.query;
  const data = await ratesService.listRates({ page, limit });
  res.json({ success: true, data });
});

/**
 * POST /api/v1/admin/rates
 * Создать новый курс CNY -> RUB (деактивирует текущий)
 */
export const createRate = asyncHandler(async (req, res) => {
  const { rate } = req.validated.body;
  const data = await ratesService.createRate(rate);
  res.status(201).json({ success: true, data });
});

/**
 * GET /api/v1/admin/settings/commission
 * Получить текущую комиссию по умолчанию
 */
export const getCommission = asyncHandler(async (req, res) => {
  const data = await settingsService.getCommission();
  res.json({ success: true, data });
});

/**
 * PUT /api/v1/admin/settings/commission
 * Установить комиссию по умолчанию
 */
export const updateCommission = asyncHandler(async (req, res) => {
  const { commissionPercent } = req.validated.body;
  const data = await settingsService.setCommission(commissionPercent);
  res.json({ success: true, data });
});

/**
 * GET /api/v1/admin/tariffs
 * Получить список тарифов доставки
 */
export const listTariffs = asyncHandler(async (req, res) => {
  const data = await tariffsService.listTariffs();
  res.json({ success: true, data });
});

/**
 * POST /api/v1/admin/tariffs
 * Создать новый тариф доставки
 */
export const createTariff = asyncHandler(async (req, res) => {
  const data = await tariffsService.createTariff(req.validated.body);
  res.status(201).json({ success: true, data });
});

/**
 * PATCH /api/v1/admin/tariffs/:id
 * Обновить тариф доставки
 */
export const updateTariff = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const data = await tariffsService.updateTariff(id, req.validated.body);
  res.json({ success: true, data });
});

/**
 * GET /api/v1/admin/users
 * Получить список пользователей с пагинацией и фильтрами
 */
export const listUsers = asyncHandler(async (req, res) => {
  const data = await usersService.listUsers(req.validated.query);
  res.json({ success: true, data });
});

/**
 * PATCH /api/v1/admin/users/:id
 * Обновить пользователя (роль и/или активность)
 */
export const updateUser = asyncHandler(async (req, res) => {
  const adminId = req.user.sub;
  const { id } = req.validated.params;
  const data = await usersService.updateUser(adminId, id, req.validated.body);
  res.json({ success: true, data });
});

/**
 * GET /api/v1/admin/stats
 * Получить статистику за период
 */
export const getStats = asyncHandler(async (req, res) => {
  const { from, to } = req.validated.query;
  const data = await statsService.getStats({ from, to });
  res.json({ success: true, data });
});