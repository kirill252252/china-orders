// Курс юаня (история и добавление нового) и комиссия сервиса.
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import Pagination from '../Pagination.jsx';
import { formatDate, formatNumber } from '../../utils/format.js';

const LIMIT = 10;

export default function AdminRates() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState(null);
  const [commission, setCommission] = useState(null);
  const [page, setPage] = useState(1);
  const [newRate, setNewRate] = useState('');
  const [newCommission, setNewCommission] = useState('');
  const [rateError, setRateError] = useState('');
  const [commissionError, setCommissionError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p) => {
    setLoading(true);
    const [cur, hist, com] = await Promise.allSettled([
      api.get('/admin/rates/current'),
      api.get('/admin/rates', { page: p, limit: LIMIT }),
      api.get('/admin/settings/commission'),
    ]);
    setCurrent(cur.status === 'fulfilled' ? cur.value.rate : null);
    if (hist.status === 'fulfilled') setHistory(hist.value);
    else setRateError(errorMessage(hist.reason));
    if (com.status === 'fulfilled') {
      setCommission(com.value.commissionPercent);
      setNewCommission(String(com.value.commissionPercent));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  async function submitRate(e) {
    e.preventDefault();
    setRateError('');
    setNotice('');
    const value = Number(newRate);
    if (!(value > 0) || value > 1000) {
      setRateError('Курс должен быть больше 0 и не больше 1000');
      return;
    }
    if (Math.abs(value * 1e6 - Math.round(value * 1e6)) > 1e-6) {
      setRateError('Не более 6 знаков после запятой');
      return;
    }
    if (!window.confirm(`Установить курс ${value} ₽ за ¥? Новые заказы и корзины будут считаться по нему. Уже созданные заказы не изменятся.`)) return;
    setBusy(true);
    try {
      await api.post('/admin/rates', { rate: value });
      setNewRate('');
      setNotice('Курс обновлён.');
      if (page === 1) await load(1);
      else setPage(1);
    } catch (err) {
      setRateError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCommission(e) {
    e.preventDefault();
    setCommissionError('');
    setNotice('');
    const value = Number(newCommission);
    if (newCommission === '' || Number.isNaN(value) || value < 0 || value > 100) {
      setCommissionError('Комиссия должна быть от 0 до 100%');
      return;
    }
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-9) {
      setCommissionError('Не более двух знаков после запятой');
      return;
    }
  
    setBusy(true);
    try {
      const res = await api.put('/admin/settings/commission', { commissionPercent: value });
      setCommission(res.commissionPercent);
      setNotice('Комиссия сохранена.');
    } catch (err) {
      setCommissionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !history) {
    return (
      <div className="center">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <>
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="two-cols">
        <div className="card">
          <h2>Курс юаня</h2>
          <div className="stat-value">{current === null ? '–' : `${formatNumber(current)} ₽`}</div>
          <p className="muted small">Сейчас действует. Используется в корзине и новых заказах.</p>
          {rateError && <div className="alert alert-error">{rateError}</div>}
          <form onSubmit={submitRate}>
            <div className="field">
              <label htmlFor="ar-rate">Новый курс, ₽ за 1 ¥</label>
              <input id="ar-rate" className="input" type="number" min="0" max="1000" step="any" inputMode="decimal" value={newRate} onChange={(e) => setNewRate(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Установить курс
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Комиссия сервиса</h2>
          <div className="stat-value">{commission === null ? '–' : `${formatNumber(commission)}%`}</div>
          <p className="muted small">Процент к стоимости товаров. Фиксируется в заказе при оформлении.</p>
          {commissionError && <div className="alert alert-error">{commissionError}</div>}
          <form onSubmit={submitCommission}>
            <div className="field">
              <label htmlFor="ar-com">Новая комиссия, %</label>
              <input id="ar-com" className="input" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={newCommission} onChange={(e) => setNewCommission(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Сохранить комиссию
            </button>
          </form>
        </div>
      </div>

      <div className="card mt-16">
        <h2>История курсов</h2>
        {history && history.items.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Курс</th>
                    <th>Источник</th>
                    <th>Действует с</th>
                    <th>До</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{formatNumber(r.rate)}</strong>
                      </td>
                      <td>{r.source === 'manual' ? 'Вручную' : 'ЦБ'}</td>
                      <td className="small">{formatDate(r.validFrom)}</td>
                      <td className="small">{r.validUntil ? formatDate(r.validUntil) : '–'}</td>
                      <td>{r.isActive ? <span className="badge badge-green">Активен</span> : <span className="badge">Закрыт</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={history.totalPages} onChange={setPage} />
          </>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>
            Курсов пока нет.
          </p>
        )}
      </div>
    </>
  );
}