// Роли пользователей: подписи и стартовая страница.
export const ROLE_LABEL = {
  customer: 'Клиент',
  manager: 'Менеджер',
  admin: 'Администратор',
};

export function homeFor(role) {
  if (role === 'manager') return '/manager';
  if (role === 'admin') return '/admin';
  return '/';
}