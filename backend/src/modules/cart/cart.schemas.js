// Zod-схемы валидации для эндпоинтов корзины.
// Используются middleware validate() на GET /cart, POST /cart/items, PATCH /cart/items/:id, DELETE /cart/items/:id, DELETE /cart.
import { z } from 'zod';

// Схема параметров запроса получения корзины (пустая, есть только auth)
export const cartGetSchema = z.object({
  query: z.object({}),
});

// Свойства позиции: новые ключи проверяются, остальные (цвет, размер) проходят как есть
const attributesSchema = z
  .object({
    category: z.string().regex(/^[a-z_]{1,40}$/, 'Некорректная категория').optional(),
    battery: z.enum(['yes', 'no']).optional(),
    link: z
      .string()
      .max(1000, 'Ссылка слишком длинная')
      .refine((v) => /^https?:\/\/\S+$/i.test(v), 'Ссылка должна начинаться с http:// или https://')
      .optional(),
    note: z.string().max(300, 'Заметка не более 300 символов').optional(),
  })
  .passthrough()
  .optional()
  .default({});

// Схема тела запроса добавления товара в корзину
export const cartItemSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^\d+$/, 'ID товара должен быть числом'),
    quantity: z.coerce.number().int().min(1).max(99),
    selectedAttributes: attributesSchema,
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