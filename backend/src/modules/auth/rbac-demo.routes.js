// Временные маршруты для проверки RBAC (ролевой доступа).
// Подключаются в app.js под префиксом /api/v1/rbac-demo.
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';

const router = Router();

// Доступен любому авторизованному пользователю (customer/manager/admin).
router.get('/customer', requireAuth, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { role: req.user.role },
  });
}));

// Доступен только менеджеру и админу.
router.get('/manager', requireAuth, requireRole('manager', 'admin'), asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { role: req.user.role },
  });
}));

// Доступен только админу.
router.get('/admin', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { role: req.user.role },
  });
}));

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default router;
