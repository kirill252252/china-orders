// Сервис аутентификации: регистрация, вход, получение пользователя.
// Работает с БД через параметризованные запросы, хеширует пароли через bcrypt.
import { hash, compare } from 'bcrypt';
import { query, tx } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { signAccessToken, signRefreshToken } from '../../utils/tokens.js';
import { storeRefreshToken, REFRESH_TTL_SECONDS } from '../../utils/jwt.js';
import { bcryptRounds } from '../../config/auth.js';
import crypto from 'crypto';

export async function registerUser({ email, password, fullName, phone }) {
  // Проверка уникальности email
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw AppError.conflict('Пользователь с таким email уже существует');
  }

  // Роль customer по умолчанию
  const roleRes = await query("SELECT id FROM roles WHERE name = 'customer'");
  if (roleRes.rows.length === 0) {
    throw AppError.internal('Роль customer не найдена');
  }
  const roleId = roleRes.rows[0].id;

  // Хеширование пароля
  const passwordHash = await hash(password, bcryptRounds);

  // Транзакция: создание пользователя и пустой корзины
  return await tx(async (client) => {
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, phone, role_id, is_active`,
      [email, passwordHash, fullName, phone, roleId]
    );
    const user = userRes.rows[0];

    await client.query('INSERT INTO carts (user_id) VALUES ($1)', [user.id]);

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: 'customer',
    };
  });
}

export async function loginUser({ email, password }) {
  // Поиск пользователя по email с названием роли
  const userRes = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role_id, u.is_active, u.password_hash,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email]
  );
  const user = userRes.rows[0];
  if (!user) {
    throw AppError.unauthorized('Неверный email или пароль');
  }
  if (!user.is_active) {
    throw new AppError('Учётная запись заблокирована', 403, 'FORBIDDEN');
  }

  // Сравнение паролей
  const match = await compare(password, user.password_hash);
  if (!match) {
    throw AppError.unauthorized('Неверный email или пароль');
  }

  // Генерация токенов
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken({ id: user.id, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id }, jti);
  await storeRefreshToken(user.id, jti, REFRESH_TTL_SECONDS);

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

export async function getUserById(userId) {
  const userRes = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role_id, u.is_active,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user || !user.is_active) {
    throw AppError.unauthorized('Пользователь не найден или не активен');
  }
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    role: user.role,
  };
}

/**
 * Проверить пользователя для обновления токена (refresh).
 * Читает актуальный is_active из БД.
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} - Данные пользователя {id, role, is_active}
 */
export async function refreshUser(userId) {
  const userRes = await query(
    `SELECT u.id, u.is_active, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) {
    throw AppError.unauthorized('Сессия недействительна');
  }
  if (!user.is_active) {
    throw new AppError('Учётная запись заблокирована', 403, 'FORBIDDEN');
  }
  return { id: user.id, role: user.role, isActive: user.is_active };
}
