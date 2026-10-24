// Zod-схемы валидации для эндпоинтов заказов.
// Используются middleware validate() на POST /api/v1/orders, GET /api/v1/orders, GET /api/v1/orders/:id.
import { z } from 'zod';

// Схема создания заказа
export const orderCreateSchema = z.object({
  body: z.object({
    addressId: z.string().regex(/^\d+$/, 'ID адреса должен быть числом').optional(),
    customerComment: z.string().max(1000, 'Комментарий не более 1000 символов').optional().default(''),
  }),
});

// Схема параметров запроса списка заказов
export const ordersListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    status: z.string().regex(/^[a-z_]{1,30}$/).optional(),
    q: z.string().trim().max(50).optional(),
  }),
});

// Схема параметра пути ID заказа
export const orderIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID заказа должен быть числом'),
  }),
});

// Схема оплаты заказа (пустое тело)
export const orderPaySchema = z.object({
  body: z.object({}),
});

// Схема параметров запроса списка заказов менеджера
export const managerOrdersListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    status: z.string().regex(/^[a-z_]{1,50}$/).optional(),
  }),
});
