// Общий каркас: шапка с меню по роли, область страницы, подвал.
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABEL } from '../utils/roles.js';

const HOME = { to: '/', label: 'Главная', end: true };
const CATALOG = { to: '/catalog', label: 'Товары' };
const CALC = { to: '/calculator', label: 'Калькулятор' };
const NAV = {
  guest: [HOME, CATALOG, CALC],
  customer: [HOME, { to: '/catalog', label: 'Мои товары' }, { to: '/cart', label: 'Корзина' }, { to: '/orders', label: 'Мои заказы' }, CALC],
  manager: [{ to: '/manager', label: 'Заказы' }, CATALOG, CALC],
  admin: [{ to: '/admin', label: 'Админка' }, { to: '/manager', label: 'Заказы' }, CATALOG, CALC],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[user?.role] || NAV.guest;

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            China Orders
          </Link>
          <nav className="nav">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="user-box">
            {user ? (
              <>
                <Link to="/profile" className="user-name" title="Профиль">
                  {user.fullName || user.email}
                  <span className="muted"> · {ROLE_LABEL[user.role] || user.role}</span>
                </Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary btn-sm">
                  Войти
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container muted">China Orders: заказы с китайских маркетплейсов</div>
      </footer>
    </div>
  );
}