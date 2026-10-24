// Zod-схемы валидации для эндпоинтов аутентификации.
// Используются middleware validate() на POST /auth/register и POST /auth/login.
import { z } from 'zod';

// Схема регистрации: email, пароль от 8 символов, имя, телефон необязательный
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
    fullName: z.string().min(1, 'Укажите имя'),
    phone: z.string().optional(),
  }),
});

// Схема логина: email и пароль
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(1, 'Укажите пароль'),
  }),
});
