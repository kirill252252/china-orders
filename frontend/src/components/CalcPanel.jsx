// Панель расчёта стоимости: итог в рублях считает сервер (GET /calc) по формуле заказа.
// Запрос уходит через 400 мс после последнего ввода, устаревшие ответы игнорируются.
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { formatCny, formatKg, formatNumber, formatRub } from '../utils/format.js';

export default function CalcPanel({ priceCny, quantity = 1, weightKg, title = 'Расчёт стоимости' }) {
  const price = Number(priceCny);
  const weight = Number(weightKg);
  const qty = Math.round(Number(quantity));
  const valid = price > 0 && price <= 1000000 && weight >= 0.001 && weight <= 1000 && qty >= 1 && qty <= 99;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!valid) {
      setData(null);
      setError('');
      setLoading(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      const id = ++reqId.current;
      setLoading(true);
      api
        .get('/calc', { priceCny: price, quantity: qty, weightKg: weight })
        .then((d) => {
          if (id === reqId.current) {
            setData(d);
            setError('');
          }
        })
        .catch((e) => {
          if (id === reqId.current) {
            setData(null);
            setError(errorMessage(e));
          }
        })
        .finally(() => id === reqId.current && setLoading(false));
    }, 400);
    return () => {
      clearTimeout(timer);
      reqId.current++;
    };
  }, [price, qty, weight, valid]);

  return (
    <div className="calc-box">
      <h2>{title}</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {!valid && <p className="muted small" style={{ margin: 0 }}>Укажите цену и вес товара: расчёт появится здесь.</p>}
      {valid && data && (
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <div className="summary-row">
            <span>
              Товар ({data.quantity} × {formatCny(data.priceCny)})
            </span>
            <span>{formatRub(data.goodsRub)}</span>
          </div>
          <div className="summary-row">
            <span>Комиссия сервиса {formatNumber(data.commissionPercent)}%</span>
            <span>{formatRub(data.commissionRub)}</span>
          </div>
          <div className="summary-row">
            <span>Доставка ({formatKg(data.totalWeightKg)})</span>
            <span>{formatRub(data.deliveryRub)}</span>
          </div>
          <div className="calc-total">
            <span>Итого</span>
            <span>{formatRub(data.totalRub)}</span>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Курс {formatNumber(data.exchangeRate)} ₽ за ¥. Расчёт ориентировочный: курс, комиссия и тариф фиксируются при оформлении заказа.
          </p>
        </div>
      )}
      {valid && !data && !error && (
        <div className="center" style={{ padding: 16 }}>
          <span className="spinner" />
        </div>
      )}
    </div>
  );
}