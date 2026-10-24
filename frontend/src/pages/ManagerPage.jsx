// Очередь заказов менеджера: вкладки по статусам, таблица с клиентом, пагинация.
// Фильтр и страница хранятся в адресной строке.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatKg, formatRub } from '../utils/format.js';
import { STATUSES } from '../utils/statuses.js';

const LIMIT = 20;
const TABS = [{ code: '', label: 'Очередь' }, ...STATUSES.map((s) => ({ code: s.code, label: s.label }))];

export default function ManagerPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const status = params.get('status') || '';
  const page = Number(params.get('page')) || 1;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get('/manager/orders', { page, limit: LIMIT, status })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, status]);

  function update(next) {
    const sp = new URLSearchParams();
    if (next.status) sp.set('status', next.status);
    if (next.page > 1) sp.set('page', String(next.page));
    setParams(sp);
  }

  return (
    <>
      <h1 className="page-title">Заказы</h1>
      <div className="tabs-scroll">
        {TABS.map((t) => (
          <button key={t.code || 'queue'} type="button" className={`tab${status === t.code ? ' active' : ''}`} onClick={() => update({ status: t.code, page: 1 })}>
            {t.label}
          </button>
        ))}
      </div>
      {!status && <p className="muted small">В очереди заказы, которым нужно действие менеджера: ожидают оплаты, оплачены, выкуплены.</p>}

      {error && <div className="alert alert-error">{error}</div>}

      {loading && !data ? (
        <div className="center">
          <span className="spinner" />
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            В этом разделе заказов нет.
          </p>
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
                    <th>Клиент</th>
                    <th>Статус</th>
                    <th>Позиций</th>
                    <th>Вес</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/manager/orders/${o.id}`}>{o.orderNumber}</Link>
                      </td>
                      <td className="small">{formatDate(o.createdAt)}</td>
                      <td>
                        {o.customer.name}
                        <div className="muted small">{o.customer.phone || o.customer.email}</div>
                      </td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>{o.itemsCount}</td>
                      <td>{formatKg(o.totalWeightKg)}</td>
                      <td>
                        <strong>{formatRub(o.totalRub)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.totalPages} onChange={(p) => update({ status, page: p })} />
          </div>
        )
      )}
    </>
  );
}