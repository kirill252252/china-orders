// Zod-схемы валидации для эндпоинтов каталога товаров.
// Используются middleware validate() на GET /products, GET /products/:id, POST /products/import, POST /products/manual.
import { z } from 'zod';

// Схема параметров запроса списка товаров
export const productListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    marketplace: z.string().optional(),
    q: z.string().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  }),
});

// Схема параметра пути ID товара
export const productIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// Схема импорта товара по ссылке
export const importSchema = z.object({
  body: z.object({
    url: z.string().url().max(2048, 'URL не должен превышать 2048 символов'),
  }),
});

// Схема ручного ввода товара
export const manualProductSchema = z.object({
  body: z.object({
    marketplace: z.string().min(1, 'Укажите маркетплейс'),
    name: z.string().min(1, 'Название обязательно').max(200, 'Название не более 200 символов'),
    priceCny: z.coerce.number().positive('Цена должна быть больше 0').max(1000000, 'Цена не более 1 000 000'),
    weightKg: z.coerce.number().positive('Вес должен быть больше 0').max(1000, 'Вес не более 1000 кг'),
    description: z.string().max(2000, 'Описание не более 2000 символов').optional().default(''),
  }),
});

// Схема параметра пути для удаления товара из личного списка
export const mineIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID товара должен быть числом'),
  }),
});
