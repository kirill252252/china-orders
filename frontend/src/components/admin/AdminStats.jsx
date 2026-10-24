// Статистика: период, карточки, заказы по статусам, графики по дням.
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import { formatNumber, formatRub } from '../../utils/format.js';
import BarChart from './BarChart.jsx';

const DAY = 24 * 60 * 60 * 1000;
const iso = (d) => d.toISOString().slice(0, 10);

// Диапазон из последних N суток по UTC, как считает сервер
function presetRange(days) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DAY);
  return { from: iso(from), to: iso(to) };
}

const PRESETS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
  { days: 365, label: 'Год' },
];

export default function AdminStats() {
  const [range, setRange] = useState(() => presetRange(30));
  const [applied, setApplied] = useState(range);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get('/admin/stats', applied)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [applied]);

  function apply(next) {
    if (!next.from || !next.to) {
      setFormError('Укажите обе даты');
      return;
    }
    const days = (new Date(next.to) - new Date(next.from)) / DAY + 1;
    if (days < 1) {
      setFormError('Начало периода позже конца');
      return;
    }
    if (days > 366) {
      setFormError('Период не может быть больше 366 дней');
      return;
    }
    setFormError('');
    setRange(next);
    setApplied(next);
  }

  const orders = data?.orders;
  const revenue = data?.revenue;
  const users = data?.users;

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="st-from">С</label>
            <input id="st-from" className="input" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="st-to">По</label>
            <input id="st-to" className="input" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => apply(range)}>
            Показать
          </button>
        </div>
        <div className="row mt-8">
          {PRESETS.map((p) => (
            <button key={p.days} type="button" className="btn btn-secondary btn-sm" onClick={() => apply(presetRange(p.days))}>
              {p.label}
            </button>
          ))}
        </div>
        {formError && <div className="alert alert-error mt-8">{formError}</div>}
        <p className="muted small mt-8" style={{ marginBottom: 0 }}>
          Даты считаются по UTC. Заказы учитываются по дате создания, выручка по дате оплаты без отменённых заказов.
        </p>
      </div>

      {error && <div className="alert alert-error mt-16">{error}</div>}

      {loading && !data ? (
        <div className="center">
          <span className="spinner" />
        </div>
      ) : (
        data && (
          <div style={{ opacity: loading ? 0.6 : 1 }}>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value">{orders.total}</div>
                <div className="muted small">Заказов создано</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{revenue.paidOrdersCount}</div>
                <div className="muted small">Оплачено заказов</div>
              </div>
              <div className="stat-card">
                <div className="stat-value stat-money">{formatRub(revenue.totalRub)}</div>
                <div className="muted small">Выручка</div>
              </div>
              <div className="stat-card">
                <div className="stat-value stat-money">{formatRub(revenue.averageOrderRub)}</div>
                <div className="muted small">Средний чек</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {users.active} / {users.total}
                </div>
                <div className="muted small">Пользователей активно / всего</div>
              </div>
            </div>

            <div className="card mt-16">
              <h2>Выручка по дням</h2>
              <BarChart data={data.byDay.map((d) => ({ label: d.date, value: d.revenueRub }))} format={formatRub} tone="alt" />
            </div>

            <div className="card mt-16">
              <h2>Новые заказы по дням</h2>
              <BarChart data={data.byDay.map((d) => ({ label: d.date, value: d.ordersCount }))} format={formatNumber} />
            </div>

            <div className="two-cols mt-16">
              <div className="card">
                <h2>Заказы по статусам</h2>
                <table className="table">
                  <tbody>
                    {orders.byStatus.map((s) => (
                      <tr key={s.code}>
                        <td>{s.nameRu}</td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>{s.count}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h2>Пользователи по ролям</h2>
                <table className="table">
                  <tbody>
                    {users.byRole.map((r) => (
                      <tr key={r.role}>
                        <td>{r.role}</td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>{r.count}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
}