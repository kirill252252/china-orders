// Zod-схемы профиля: имя, телефон и смена пароля.
import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(1, 'Укажите имя').max(255).optional(),
      phone: z
        .string()
        .trim()
        .max(50, 'Телефон не длиннее 50 символов')
        .regex(/^[0-9+()\-\s]*$/, 'Телефон: только цифры, пробелы и символы + - ( )')
        .optional(),
    })
    .refine((b) => b.fullName !== undefined || b.phone !== undefined, { message: 'Укажите хотя бы одно поле' }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Введите текущий пароль').max(200),
      newPassword: z.string().min(8, 'Пароль должен быть не короче 8 символов').max(72, 'Пароль не длиннее 72 символов'),
    })
    .refine((b) => b.currentPassword !== b.newPassword, { message: 'Новый пароль совпадает с текущим', path: ['newPassword'] }),
});