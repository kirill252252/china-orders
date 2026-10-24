// Пользователи: поиск, фильтры, смена роли и блокировка.
// Администраторами управляет только главный администратор; себя изменить нельзя.
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import Pagination from '../Pagination.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatDate } from '../../utils/format.js';
import { ROLE_LABEL } from '../../utils/roles.js';

const LIMIT = 15;

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [access, setAccess] = useState({ isSuperAdmin: false, superAdminId: null });
  const [form, setForm] = useState({ q: '', role: '', isActive: '' });
  const [filters, setFilters] = useState(form);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api.get('/admin/access').then(setAccess).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get('/admin/users', { page, limit: LIMIT, q: filters.q.trim(), role: filters.role, isActive: filters.isActive })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [filters, page]);

  function applyFilters(e) {
    e.preventDefault();
    setPage(1);
    setFilters(form);
  }

  function resetFilters() {
    const empty = { q: '', role: '', isActive: '' };
    setForm(empty);
    setPage(1);
    setFilters(empty);
  }

  async function patch(u, body, text) {
    setBusyId(u.id);
    setError('');
    setNotice('');
    try {
      const updated = await api.patch(`/admin/users/${u.id}`, body);
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === u.id ? { ...x, ...updated } : x)) }));
      setNotice(text);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  function changeRole(u, role) {
    if (role === u.role) return;
    const warn = role === 'admin' ? ' Пользователь получит полный доступ к админке.' : '';
    if (!window.confirm(`Изменить роль пользователя ${u.email} на «${ROLE_LABEL[role]}»? Его сессии будут завершены.${warn}`)) return;
    patch(u, { role }, 'Роль изменена, сессии пользователя завершены.');
  }

  function toggleBlock(u) {
    const text = u.isActive ? `Заблокировать ${u.email}? Его сессии будут завершены.` : `Разблокировать ${u.email}?`;
    if (!window.confirm(text)) return;
    patch(u, { isActive: !u.isActive }, u.isActive ? 'Пользователь заблокирован.' : 'Пользователь разблокирован.');
  }

  return (
    <>
      {!access.isSuperAdmin && (
        <div className="alert alert-info">Назначать, снимать и блокировать администраторов может только главный администратор.</div>
      )}

      <form className="card filters" onSubmit={applyFilters} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
        <div className="field">
          <label htmlFor="u-q">Поиск по почте или имени</label>
          <input id="u-q" className="input" maxLength={100} value={form.q} onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="u-role">Роль</label>
          <select id="u-role" className="select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="">Все</option>
            <option value="customer">Клиент</option>
            <option value="manager">Менеджер</option>
            <option value="admin">Администратор</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="u-active">Статус</label>
          <select id="u-active" className="select" value={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value }))}>
            <option value="">Все</option>
            <option value="true">Активные</option>
            <option value="false">Заблокированные</option>
          </select>
        </div>
        <div className="row filters-actions">
          <button type="submit" className="btn btn-primary">
            Найти
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>
            Сбросить
          </button>
        </div>
      </form>

      {error && <div className="alert alert-error mt-16">{error}</div>}
      {notice && <div className="alert alert-success mt-16">{notice}</div>}

      {loading && !data ? (
        <div className="center">
          <span className="spinner" />
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="card mt-16">
          <p className="muted" style={{ margin: 0 }}>
            Пользователи не найдены.
          </p>
        </div>
      ) : (
        data && (
          <div className="card mt-16" style={{ opacity: loading ? 0.6 : 1 }}>
            <p className="muted small" style={{ marginTop: 0 }}>
              Найдено: {data.total}
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Роль</th>
                    <th>Заказов</th>
                    <th>Регистрация</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => {
                    const self = me && String(me.id) === String(u.id);
                    const isSuper = access.superAdminId !== null && String(access.superAdminId) === String(u.id);
                    const adminLocked = u.role === 'admin' && !access.isSuperAdmin;
                    const roleLocked = self || isSuper || adminLocked || busyId === u.id;
                    const canBlock = !self && !isSuper && !adminLocked;
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.fullName}</strong>
                          {self && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Вы</span>}
                          {isSuper && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>Главный</span>}
                          <div className="muted small">{u.email}</div>
                        </td>
                        <td>
                          <select className="select select-inline" value={u.role} disabled={roleLocked} onChange={(e) => changeRole(u, e.target.value)} aria-label="Роль">
                            <option value="customer">Клиент</option>
                            <option value="manager">Менеджер</option>
                            {(access.isSuperAdmin || u.role === 'admin') && <option value="admin">Администратор</option>}
                          </select>
                        </td>
                        <td>{u.ordersCount}</td>
                        <td className="small">{formatDate(u.createdAt)}</td>
                        <td>{u.isActive ? <span className="badge badge-green">Активен</span> : <span className="badge badge-red">Заблокирован</span>}</td>
                        <td className="actions-cell">
                          {canBlock && (
                            <button type="button" className={`btn btn-sm ${u.isActive ? 'btn-secondary' : 'btn-primary'}`} disabled={busyId === u.id} onClick={() => toggleBlock(u)}>
                              {u.isActive ? 'Заблокировать' : 'Разблокировать'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        )
      )}
    </>
  );
}