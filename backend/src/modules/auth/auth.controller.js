// Контроллер аутентификации: HTTP-обработчики для register, login, me, refresh, logout, logout-all.
// Все ответы следуют единому формату: { success, data, error }.
import { asyncHandler } from '../../utils/asyncHandler.js';
import { registerUser, loginUser, getUserById } from './auth.service.js';
import { storeRefreshToken, isRefreshTokenValid, revokeRefreshToken, revokeAllUserTokens, markRefreshTokenUsed, getUsedRefreshTokenUser, REFRESH_TTL_SECONDS } from '../../utils/jwt.js';
import { verifyRefresh, signAccessToken, signRefreshToken } from '../../utils/tokens.js';
import { AppError } from '../../utils/errors.js';
import { query } from '../../config/db.js';
import crypto from 'crypto';

const REFRESH_TTL_MS = REFRESH_TTL_SECONDS * 1000;

function setRefreshCookie(res, refreshToken) {
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/v1/auth',
    maxAge: REFRESH_TTL_MS,
  });
}

export const register = asyncHandler(async (req, res) => {
  const { email, password, fullName, phone } = req.validated.body;
  const user = await registerUser({ email, password, fullName, phone });
  res.status(201).json({
    success: true,
    data: { user },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const { accessToken, refreshToken, user } = await loginUser({ email, password });
  setRefreshCookie(res, refreshToken);
  res.json({
    success: true,
    data: { user, accessToken },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.sub);
  res.json({
    success: true,
    data: { user },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    throw AppError.unauthorized('Сессия недействительна');
  }

  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    throw AppError.unauthorized('Сессия недействительна');
  }

  const jti = payload.jti;

  if (!(await isRefreshTokenValid(jti))) {
    // Токен уже обменян: возможна кража, отзываем все сессии пользователя
    const reusedBy = await getUsedRefreshTokenUser(jti);
    if (reusedBy) {
      await revokeAllUserTokens(reusedBy);
    }
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    throw AppError.unauthorized('Сессия недействительна');
  }

  // Получаем пользователя из БД с ролью
  const userRes = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.is_active, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [payload.sub]
  );
  const user = userRes.rows[0];
  if (!user || !user.is_active) {
    await revokeAllUserTokens(payload.sub);
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    throw AppError.unauthorized('Сессия недействительна');
  }

  // Ротация: отзываем старый jti, создаём новый
  await revokeRefreshToken(jti);
  await markRefreshTokenUsed(jti, user.id);
  const newJti = crypto.randomUUID();
  const newAccessToken = signAccessToken({ id: user.id, role: user.role });
  const newRefreshToken = signRefreshToken({ id: user.id }, newJti);
  await storeRefreshToken(user.id, newJti, REFRESH_TTL_SECONDS);

  setRefreshCookie(res, newRefreshToken);

  res.json({
    success: true,
    data: { accessToken: newAccessToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (refreshToken) {
    try {
      const payload = verifyRefresh(refreshToken);
      await revokeRefreshToken(payload.jti);
    } catch {
      // Игнорируем ошибку подписи — всё равно чистим куку
    }
  }

  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  res.json({ success: true });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllUserTokens(req.user.sub);
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  res.json({ success: true });
});
