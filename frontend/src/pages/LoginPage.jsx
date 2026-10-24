// Страница входа. Кнопки демо-доступа заполняют форму (пароль тестовых аккаунтов один).
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api/client.js';
import { homeFor } from '../utils/roles.js';

const DEMO = [
  { label: 'Клиент', email: 'customer@test.local' },
  { label: 'Менеджер', email: 'manager@test.local' },
  { label: 'Админ', email: 'admin@test.local' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const next = await login(email.trim(), password);
      const from = location.state?.from?.pathname;
      navigate(from && from !== '/login' ? from : homeFor(next.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1 className="page-title">Вход</h1>
      {location.state?.notice && <div className="alert alert-success">{location.state.notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Эл. почта</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>

      <p className="muted mt-16">
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>

      <div className="demo-box">
        <div className="muted">Демо-доступ (пароль Test1234!):</div>
        <div className="row">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setEmail(d.email);
                setPassword('Test1234!');
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}