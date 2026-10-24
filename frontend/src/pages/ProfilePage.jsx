// Профиль: имя, телефон и смена пароля. После смены пароля нужно войти заново.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABEL } from '../utils/roles.js';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ fullName: user.fullName || '', phone: user.phone || '' });
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileNotice('');
    if (!profile.fullName.trim()) {
      setProfileError('Укажите имя');
      return;
    }
    setBusy(true);
    try {
      await api.patch('/profile', { fullName: profile.fullName.trim(), phone: profile.phone.trim() });
      await refreshUser();
      setProfileNotice('Данные сохранены.');
    } catch (err) {
      setProfileError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwError('');
    if (pw.newPassword.length < 8) {
      setPwError('Новый пароль должен быть не короче 8 символов');
      return;
    }
    if (pw.newPassword !== pw.confirm) {
      setPwError('Новые пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      await api.post('/profile/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      await logout();
      navigate('/login', { replace: true, state: { notice: 'Пароль изменён. Войдите с новым паролем.' } });
    } catch (err) {
      setPwError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Профиль</h1>
      <div className="two-cols">
        <div className="card">
          <h2>Личные данные</h2>
          <dl className="info-grid" style={{ marginBottom: 16 }}>
            <dt>Почта</dt>
            <dd>{user.email}</dd>
            <dt>Роль</dt>
            <dd>{ROLE_LABEL[user.role] || user.role}</dd>
          </dl>
          {profileError && <div className="alert alert-error">{profileError}</div>}
          {profileNotice && <div className="alert alert-success">{profileNotice}</div>}
          <form onSubmit={saveProfile}>
            <div className="field">
              <label htmlFor="p-name">Имя</label>
              <input id="p-name" className="input" maxLength={255} required value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="p-phone">Телефон</label>
              <input id="p-phone" className="input" type="tel" maxLength={50} value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Сохранить
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Смена пароля</h2>
          <p className="muted small" style={{ marginTop: 0 }}>После смены пароля все сессии завершатся, потребуется войти заново.</p>
          {pwError && <div className="alert alert-error">{pwError}</div>}
          <form onSubmit={savePassword}>
            <div className="field">
              <label htmlFor="pw-cur">Текущий пароль</label>
              <input id="pw-cur" className="input" type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="pw-new">Новый пароль (от 8 символов)</label>
              <input id="pw-new" className="input" type="password" autoComplete="new-password" required value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="pw-conf">Повторите новый пароль</label>
              <input id="pw-conf" className="input" type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Изменить пароль
            </button>
          </form>
        </div>
      </div>
    </>
  );
}