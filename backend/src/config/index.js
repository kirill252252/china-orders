import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  POSTGRES_HOST: z.string().default('postgres'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default('china_orders'),
  POSTGRES_USER: z.string().default('app_user'),
  POSTGRES_PASSWORD: z.string().default('secure_password'),

  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/, 'Формат TTL: число + s|m|h|d, например 15m или 7d'),
  JWT_REFRESH_TTL: z.string().regex(/^\d+[smhd]$/, 'Формат TTL: число + s|m|h|d, например 7d'),
  // Белый список origins для CORS через запятую
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  // Стоимость хеширования bcrypt
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(20).default(12),

  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(10),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_IMPORT_MAX: z.coerce.number().default(20),
  RATE_LIMIT_IMPORT_WINDOW_MS: z.coerce.number().default(60000),

  MOCK_PROVIDER_ENABLED: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config = parsed.data;

export const isDev = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';