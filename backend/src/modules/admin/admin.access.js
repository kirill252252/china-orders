// Права на управление администраторами: только главный администратор.
// Права читаются из БД, а не из токена: токен живёт 15 минут и мог устареть.
import { query } from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

async function loadUser(id) {
  const res = await query(
    `SELECT u.id, u.is_super_admin, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

/** Middleware для PATCH /admin/users/:id: ограничивает действия с администраторами. */
export const guardAdminChanges = asyncHandler(async (req, res, next) => {
  const actor = await loadUser(req.user.sub);
  const target = await loadUser(req.validated.params.id);

  // Несуществующий пользователь (404) и изменение самого себя (409) обрабатывает сервис
  if (!actor || !target || String(actor.id) === String(target.id)) return next();

  if (target.is_super_admin) {
    throw new AppError('Главного администратора изменить нельзя', 403, 'FORBIDDEN');
  }
  const touchesAdmin = target.role === 'admin' || req.validated.body.role === 'admin';
  if (touchesAdmin && !actor.is_super_admin) {
    throw new AppError('Назначать, снимать и блокировать администраторов может только главный администратор', 403, 'FORBIDDEN');
  }
  return next();
});

/** GET /admin/access: права текущего администратора и id главного. */
export const getAccess = asyncHandler(async (req, res) => {
  const me = await loadUser(req.user.sub);
  const sup = await query(`SELECT id FROM users WHERE is_super_admin LIMIT 1`);
  res.json({
    success: true,
    data: { isSuperAdmin: Boolean(me?.is_super_admin), superAdminId: sup.rows[0]?.id ?? null },
  });
});