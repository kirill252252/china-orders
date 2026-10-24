// Zod-схемы адресов клиента.
import { z } from 'zod';

const optionalText = (max) => z.string().trim().max(max).optional();

export const createAddressSchema = z.object({
  body: z.object({
    country: z.string().trim().min(1, 'Укажите страну').max(100).default('Россия'),
    region: optionalText(100),
    city: z.string().trim().min(1, 'Укажите город').max(100),
    street: z.string().trim().min(1, 'Укажите улицу').max(255),
    building: z.string().trim().min(1, 'Укажите дом').max(50),
    apartment: optionalText(50),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5,10}$/, 'Индекс: от 5 до 10 цифр')
      .optional()
      .or(z.literal('')),
    isDefault: z.boolean().optional(),
  }),
});

export const addressIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID адреса должен быть числом'),
  }),
});