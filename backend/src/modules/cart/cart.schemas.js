// Zod-схемы валидации для эндпоинтов корзины.
// Используются middleware validate() на GET /cart, POST /cart/items, PATCH /cart/items/:id, DELETE /cart/items/:id, DELETE /cart.
import { z } from 'zod';

// Схема параметров запроса получения корзины (пустая, есть только auth)
export const cartGetSchema = z.object({
  query: z.object({}),
});

// Схема тела запроса добавления товара в корзину
export const cartItemSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^\d+$/, 'ID товара должен быть числом'),
    quantity: z.coerce.number().int().min(1).max(99),
    selectedAttributes: z.object({}).passthrough().optional().default({}),
  }),
});

// Схема параметра пути ID позиции корзины
export const cartItemIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID позиции должен быть числом'),
  }),
});

export const cartItemUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID позиции должен быть числом'),
  }),
  body: z.object({
    quantity: z.coerce.number().int().min(1).max(99),
  }),
});
