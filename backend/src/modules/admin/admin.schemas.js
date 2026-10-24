// Схемы валидации для админки.
import { z } from 'zod';

/**
 * Схема для списка курсов валют
 */
export const listRatesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

/**
 * Схема для создания нового курса валют
 */
export const createRateSchema = z.object({
  body: z.object({
    rate: z.coerce.number().positive().max(1000),
  }),
});

/**
 * Схема для обновления комиссии по умолчанию
 */
export const updateCommissionSchema = z.object({
  body: z.object({
    commissionPercent: z.coerce
      .number()
      .min(0)
      .max(100)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, 'Не более 2 знаков после запятой'),
  }),
});

/**
 * Схема для создания тарифа доставки
 */
export const createTariffSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    minWeightKg: z.coerce.number().min(0),
    maxWeightKg: z.coerce.number().positive().nullable(),
    baseCostRub: z.coerce.number().min(0),
    perKgCostRub: z.coerce.number().min(0),
    minDays: z.coerce.number().int().min(0),
    maxDays: z.coerce.number().int().min(0),
    isActive: z.coerce.boolean().default(true),
  }).refine((data) => data.maxWeightKg === null || data.maxWeightKg > data.minWeightKg, {
    message: 'maxWeightKg должен быть больше minWeightKg или null',
    path: ['maxWeightKg'],
  }).refine((data) => data.maxDays >= data.minDays, {
    message: 'maxDays должен быть >= minDays',
    path: ['maxDays'],
  }),
});

/**
 * Схема для обновления тарифа доставки
 */
export const updateTariffSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID должен быть числом'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    minWeightKg: z.coerce.number().min(0).optional(),
    maxWeightKg: z.coerce.number().positive().nullable().optional(),
    baseCostRub: z.coerce.number().min(0).optional(),
    perKgCostRub: z.coerce.number().min(0).optional(),
    minDays: z.coerce.number().int().min(0).optional(),
    maxDays: z.coerce.number().int().min(0).optional(),
    isActive: z.coerce.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'Укажите хотя бы одно поле',
    path: [],
  }),
});

/**
 * Схема для списка пользователей
 */
export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    role: z.enum(['customer', 'manager', 'admin']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    q: z.string().max(100).optional(),
  }),
});

/**
 * Схема для обновления пользователя
 */
export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID должен быть числом'),
  }),
  body: z.object({
    role: z.enum(['customer', 'manager', 'admin']).optional(),
    isActive: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'Укажите хотя бы одно поле',
    path: [],
  }),
});

/**
 * Схема для статистики
 */
export const statsSchema = z.object({
  query: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверный формат даты (YYYY-MM-DD)').optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверный формат даты (YYYY-MM-DD)').optional(),
  }),
});