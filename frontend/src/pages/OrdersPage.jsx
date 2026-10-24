// Мои заказы: вкладки по статусам, поиск по номеру и пагинация (параметры в адресной строке).
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatRub } from '../utils/format.js';
import { STATUSES } from '../utils/statuses.js';

const LIMIT = 10;
const TABS = [{ code: '', label: 'Все' }, ...STATUSES.map((s) => ({ code: s.code, label: s.label }))];

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const status = params.get('status') || '';
  const q = params.get('q') || '';
  const page = Number(params.get('page')) || 1;
  const [search, setSearch] = useState(q);

  // Поле поиска следует за адресной строкой (кнопка «Сбросить», переход назад)
  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get('/orders', { page, limit: LIMIT, status, q })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, status, q]);

  function update(next) {
    const sp = new URLSearchParams();
    if (next.status) sp.set('status', next.status);
    if (next.q) sp.set('q', next.q);
    if (next.page > 1) sp.set('page', String(next.page));
    setParams(sp);
  }

  function submitSearch(e) {
    e.preventDefault();
    update({ status, q: search.trim(), page: 1 });
  }

  return (
    <>
      <h1 className="page-title">Мои заказы</h1>
      <div className="tabs-scroll">
        {TABS.map((t) => (
          <button key={t.code || 'all'} type="button" className={`tab${status === t.code ? ' active' : ''}`} onClick={() => update({ status: t.code, q, page: 1 })}>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submitSearch} style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="input"
          placeholder="Номер заказа, например CN-2026"
          value={search}
          maxLength={50}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', maxWidth: 360 }}
        />
        <button type="submit" className="btn btn-primary">
          Найти
        </button>
        {q && (
          <button type="button" className="btn btn-secondary" onClick={() => update({ status, q: '', page: 1 })}>
            Сбросить
          </button>
        )}
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && !data ? (
        <div className="center">
          <span className="spinner" />
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            {q ? 'По вашему запросу заказов не найдено.' : status ? 'Заказов с таким статусом нет.' : 'У вас пока нет заказов.'}
          </p>
          {!q && (
            <Link to="/catalog" className="btn btn-primary">
              Перейти к товарам
            </Link>
          )}
        </div>
      ) : (
        data && (
          <div className="card" style={{ opacity: loading ? 0.6 : 1 }}>
            <p className="muted small" style={{ marginTop: 0 }}>
              Найдено заказов: {data.total}
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Позиций</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`}>{o.orderNumber}</Link>
                      </td>
                      <td className="small">{formatDate(o.createdAt)}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>{o.itemsCount}</td>
                      <td>
                        <strong>{formatRub(o.totalRub)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.totalPages} onChange={(p) => update({ status, q, page: p })} />
          </div>
        )
      )}
    </>
  );
}