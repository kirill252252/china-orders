// Карточка заказа: состав, расчёт, адрес, платежи, отгрузка, история статусов и оплата.
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatAddress } from '../utils/address.js';
import { formatCny, formatDate, formatKg, formatNumber, formatRub } from '../utils/format.js';
import { ROLE_LABEL } from '../utils/roles.js';

const PAYMENT_STATUS = { pending: 'Ожидает', success: 'Успешно', failed: 'Ошибка', refunded: 'Возврат' };
const PAYMENT_METHOD = { mock: 'Демо-оплата', card: 'Карта', sbp: 'СБП' };
const CARRIER = { cdek: 'СДЭК', russian_post: 'Почта России', ems: 'EMS', other: 'Другой перевозчик' };

function who(changedBy) {
  if (!changedBy) return '';
  return changedBy.name || ROLE_LABEL[changedBy.role] || '';
}

function attributesText(attrs) {
  const entries = Object.entries(attrs || {});
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '';
}

export default function OrderPage() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payError, setPayError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get(`/orders/${id}`)
      .then((d) => alive && setOrder(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  async function pay() {
    setBusy(true);
    setPayError('');
    try {
      setOrder(await api.post(`/orders/${id}/pay`));
      setNotice('Оплата прошла успешно (демонстрационный режим). Менеджер приступит к выкупу товара.');
    } catch (e) {
      setPayError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="center">
        <span className="spinner" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="card">
        <div className="alert alert-error">{error}</div>
        <Link to="/orders" className="btn btn-secondary">
          К списку заказов
        </Link>
      </div>
    );
  }

  const canPay = ['new', 'awaiting_payment'].includes(order.status.code);
  const goodsRub = Number(order.totalRub) - Number(order.deliveryCostRub);
  const shipment = order.shipment;
  const tracking = shipment?.trackingNumber ?? shipment?.tracking_number;
  const carrier = shipment?.carrier;

  return (
    <>
      <p>
        <Link to="/orders">← Мои заказы</Link>
      </p>
      {notice && <div className="alert alert-success">{notice}</div>}
      {payError && <div className="alert alert-error">{payError}</div>}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Заказ {order.orderNumber}
        </h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="muted small">Создан {formatDate(order.createdAt)}</p>

      <div className="cart-layout">
        <div>
          <div className="card">
            <h2>Состав заказа</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Цена</th>
                    <th>Кол-во</th>
                    <th>Вес</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((i, idx) => (
                    <tr key={`${i.productId}-${idx}`}>
                      <td>
                        <Link to={`/products/${i.productId}`}>{i.name}</Link>
                        {attributesText(i.selectedAttributes) && <div className="muted small">{attributesText(i.selectedAttributes)}</div>}
                      </td>
                      <td>{formatCny(i.priceCny)}</td>
                      <td>{i.quantity}</td>
                      <td>{formatKg(i.weightKg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-16">
            <h2>Доставка</h2>
            {order.address ? <p style={{ marginTop: 0 }}>{formatAddress(order.address)}</p> : <p className="muted">Адрес не указан.</p>}
            {shipment ? (
              <div className="small">
                {carrier && <div>Перевозчик: {CARRIER[carrier] || carrier}</div>}
                {tracking ? <div>Трек-номер: <strong>{tracking}</strong></div> : <div className="muted">Трек-номер пока не присвоен.</div>}
                {Number(shipment.weightKg ?? shipment.weight_kg) > 0 && <div>Фактический вес: {formatKg(shipment.weightKg ?? shipment.weight_kg)}</div>}
              </div>
            ) : (
              <p className="muted small" style={{ marginBottom: 0 }}>
                Отправление появится после выкупа товара.
              </p>
            )}
            {order.customerComment && (
              <p className="small mt-16" style={{ marginBottom: 0 }}>
                <span className="muted">Ваш комментарий:</span> {order.customerComment}
              </p>
            )}
          </div>

          <div className="card mt-16">
            <h2>История заказа</h2>
            <ul className="timeline">
              {order.timeline.map((t, idx) => (
                <li key={idx}>
                  <div>
                    <strong>{t.status.nameRu}</strong>
                    <span className="muted small"> · {formatDate(t.createdAt)}</span>
                  </div>
                  {who(t.changedBy) && <div className="muted small">{who(t.changedBy)}</div>}
                  {t.comment && <div className="small">{t.comment}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside>
          <div className="card">
            <h2>Стоимость</h2>
            <div className="summary-row">
              <span>Товары в юанях</span>
              <span>{formatCny(order.subtotalCny)}</span>
            </div>
            <div className="summary-row">
              <span>Курс</span>
              <span>{formatNumber(order.exchangeRate)} ₽/¥</span>
            </div>
            <div className="summary-row">
              <span>Комиссия</span>
              <span>{formatNumber(order.commissionPercent)}%</span>
            </div>
            <div className="summary-row">
              <span>Товары в рублях</span>
              <span>{formatRub(goodsRub)}</span>
            </div>
            <div className="summary-row">
              <span>Доставка</span>
              <span>{formatRub(order.deliveryCostRub)}</span>
            </div>
            <div className="summary-row summary-total">
              <span>Итого</span>
              <span>{formatRub(order.totalRub)}</span>
            </div>
            {canPay && (
              <>
                <button type="button" className="btn btn-primary btn-block mt-16" disabled={busy} onClick={pay}>
                  {busy ? 'Оплачиваем…' : `Оплатить ${formatRub(order.totalRub)}`}
                </button>
                <p className="muted small mt-8">Оплата демонстрационная: деньги не списываются.</p>
              </>
            )}
          </div>

          <div className="card mt-16">
            <h2>Платежи</h2>
            {order.payments.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Платежей пока нет.
              </p>
            ) : (
              order.payments.map((p) => (
                <div className="summary-row small" key={p.id}>
                  <span>
                    {PAYMENT_METHOD[p.method] || p.method}, {PAYMENT_STATUS[p.status] || p.status}
                    <div className="muted">{formatDate(p.paidAt || p.createdAt)}</div>
                  </span>
                  <span>{formatRub(p.amountRub)}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  );
}