// Подпись и проверка JWT-токенов (чистые функции, без Redis).
// Хранение/отзыв refresh-токенов — в src/utils/jwt.js (Redis).
import jwt from 'jsonwebtoken';
import {
  jwtAccessSecret,
  jwtRefreshSecret,
  accessTtl,
  refreshTtl,
} from '../config/auth.js';

// Подписать access-токен: payload { sub: id, role } (без email)
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    jwtAccessSecret,
    { expiresIn: accessTtl },
  );
}

// Подписать refresh-токен: payload { sub: id, jti }
// jti генерирует вызывающий код (например randomUUID), чтобы токен можно было отозвать
export function signRefreshToken(user, jti) {
  return jwt.sign(
    { sub: user.id, jti },
    jwtRefreshSecret,
    { expiresIn: refreshTtl },
  );
}

// Проверить access-токен, вернуть payload. Бросает JsonWebTokenError / TokenExpiredError
export function verifyAccess(token) {
  return jwt.verify(token, jwtAccessSecret);
}

// Проверить refresh-токен, вернуть payload. Бросает JsonWebTokenError / TokenExpiredError
export function verifyRefresh(token) {
  return jwt.verify(token, jwtRefreshSecret);
}
