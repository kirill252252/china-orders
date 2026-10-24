// Тонкий адаптер конфига аутентификации над центральным конфигом (src/config/index.js).
// Единый источник имён переменных для модуля auth.
import { config } from './index.js';

export const jwtAccessSecret = config.JWT_ACCESS_SECRET;
export const jwtRefreshSecret = config.JWT_REFRESH_SECRET;
export const accessTtl = config.JWT_ACCESS_TTL;
export const refreshTtl = config.JWT_REFRESH_TTL;
export const bcryptRounds = config.BCRYPT_ROUNDS;
export const corsOrigins = config.CORS_ORIGINS;
