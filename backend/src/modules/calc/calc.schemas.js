// Схема параметров калькулятора стоимости.
import { z } from 'zod';

export const calcSchema = z.object({
  query: z.object({
    priceCny: z.coerce.number().positive().max(1000000),
    quantity: z.coerce.number().int().min(1).max(99).default(1),
    weightKg: z.coerce.number().min(0.001).max(1000),
  }),
});