// Регистрация клиента. После успеха выполняется вход тем же паролем.
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../utils/roles.js';

export default function RegisterPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Пароль должен быть не короче 8 символов');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      const body = { email: form.email.trim(), password: form.password, fullName: form.fullName.trim() };
      if (form.phone.trim()) body.phone = form.phone.trim();
      await api.post('/auth/register', body);
      const next = await login(body.email, form.password);
      navigate(homeFor(next.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1 className="page-title">Регистрация</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="r-name">Имя</label>
          <input id="r-name" className="input" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <div className="field">
          <label htmlFor="r-email">Эл. почта</label>
          <input id="r-email" className="input" type="email" autoComplete="username" required value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="r-phone">Телефон (необязательно)</label>
          <input id="r-phone" className="input" type="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="r-pass">Пароль (от 8 символов)</label>
          <input id="r-pass" className="input" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} />
        </div>
        <div className="field">
          <label htmlFor="r-conf">Повторите пароль</label>
          <input id="r-conf" className="input" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Регистрируем…' : 'Зарегистрироваться'}
        </button>
      </form>
      <p className="muted mt-16">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </div>
  );
}