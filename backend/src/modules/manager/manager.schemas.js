// Zod-схемы маршрутов менеджера: список заказов и смена статуса.
import { z } from 'zod';

export const managerListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.string().min(1).max(50).optional(),
  }),
});

export const managerStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID заказа должен быть числом'),
  }),
  body: z.object({
    status: z.string().min(1, 'Укажите статус').max(50),
    comment: z.string().trim().max(1000).optional(),
  }),
});

export const managerShipmentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID заказа должен быть числом'),
  }),
  body: z
    .object({
      trackingNumber: z.string().trim().min(1).max(100).optional(),
      carrier: z.enum(['cdek', 'russian_post', 'ems', 'other']).optional(),
      weightKg: z.coerce.number().min(0).max(1000).optional(),
      estimatedArrival: z.string().datetime({ offset: true }).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'Укажите хотя бы одно поле' }),
});

export const managerCommentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID заказа должен быть числом'),
  }),
  body: z.object({
    comment: z.string().trim().max(2000),
  }),
});