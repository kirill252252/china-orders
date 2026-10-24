// Карточка заказа для менеджера: следующий статус, отмена с причиной, отправление, внутренняя заметка.
// Правила переходов совпадают с таблицей order_status_transitions; окончательно проверяет сервер.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatAddress } from '../utils/address.js';
import { formatCny, formatDate, formatKg, formatNumber, formatRub } from '../utils/format.js';
import { STATUS_BY_CODE } from '../utils/statuses.js';

// Следующий статус вручную; paid ставит клиент через оплату
const NEXT = {
  paid: 'purchased',
  purchased: 'shipped_from_china',
  shipped_from_china: 'in_transit',
  in_transit: 'arrived_warehouse',
  arrived_warehouse: 'delivered',
};
const CANCELLABLE = ['new', 'awaiting_payment', 'paid', 'purchased'];
const SHIPMENT_STATUSES = ['purchased', 'shipped_from_china', 'in_transit', 'arrived_warehouse', 'delivered'];
const CARRIERS = [
  { value: 'cdek', label: 'СДЭК' },
  { value: 'russian_post', label: 'Почта России' },
  { value: 'ems', label: 'EMS' },
  { value: 'other', label: 'Другой' },
];
const PAYMENT_STATUS = { pending: 'Ожидает', success: 'Успешно', failed: 'Ошибка', refunded: 'Возврат' };
const PAYMENT_METHOD = { mock: 'Демо-оплата', card: 'Карта', sbp: 'СБП' };

function attributesText(attrs) {
  const entries = Object.entries(attrs || {});
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '';
}

export default function ManagerOrderPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [note, setNote] = useState('');
  const [ship, setShip] = useState({ trackingNumber: '', carrier: '', weightKg: '' });

  function applyOrder(o) {
    setOrder(o);
    setNote(o.managerComment || '');
    setShip({
      trackingNumber: o.shipment?.trackingNumber || '',
      carrier: o.shipment?.carrier || '',
      weightKg: o.shipment && o.shipment.weightKg > 0 ? String(o.shipment.weightKg) : '',
    });
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get(`/orders/${id}`)
      .then((o) => alive && applyOrder(o))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  async function run(fn, successText) {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      applyOrder(await fn());
      setNotice(successText);
      return true;
    } catch (e) {
      setActionError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function moveTo(code) {
    const body = { status: code };
    if (comment.trim()) body.comment = comment.trim();
    const ok = await run(() => api.patch(`/manager/orders/${id}/status`, body), `Статус изменён: ${STATUS_BY_CODE[code].label}.`);
    if (ok) setComment('');
  }

  async function cancelOrder() {
    if (!cancelReason.trim()) {
      setActionError('Укажите причину отмены');
      return;
    }
    if (!window.confirm('Отменить заказ? Это действие нельзя отменить.')) return;
    const ok = await run(() => api.patch(`/manager/orders/${id}/status`, { status: 'cancelled', comment: cancelReason.trim() }), 'Заказ отменён.');
    if (ok) setCancelReason('');
  }

  async function saveShipment(e) {
    e.preventDefault();
    const body = {};
    if (ship.trackingNumber.trim()) body.trackingNumber = ship.trackingNumber.trim();
    if (ship.carrier) body.carrier = ship.carrier;
    if (ship.weightKg !== '' && Number(ship.weightKg) >= 0) body.weightKg = Number(ship.weightKg);
    if (Object.keys(body).length === 0) {
      setActionError('Заполните хотя бы одно поле отправления');
      return;
    }
    await run(() => api.patch(`/manager/orders/${id}/shipment`, body), 'Отправление сохранено.');
  }

  async function saveNote() {
    await run(() => api.patch(`/manager/orders/${id}/comment`, { comment: note.trim() }), 'Заметка сохранена.');
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
        <Link to="/manager" className="btn btn-secondary">
          К списку заказов
        </Link>
      </div>
    );
  }

  const code = order.status.code;
  const nextCode = NEXT[code];
  const canCancel = CANCELLABLE.includes(code);
  const canShip = SHIPMENT_STATUSES.includes(code);
  const finished = code === 'delivered' || code === 'cancelled';
  const goodsRub = Number(order.totalRub) - Number(order.deliveryCostRub);

  return (
    <>
      <p>
        <Link to="/manager">← Все заказы</Link>
      </p>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Заказ {order.orderNumber}
        </h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="muted small">Создан {formatDate(order.createdAt)}</p>
      {notice && <div className="alert alert-success">{notice}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="cart-layout">
        <div>
          <div className="card">
            <h2>Клиент и доставка</h2>
            <dl className="info-grid">
              {order.customer && (
                <>
                  <dt>Клиент</dt>
                  <dd>{order.customer.name}</dd>
                  <dt>Телефон</dt>
                  <dd>{order.customer.phone || '–'}</dd>
                  <dt>Почта</dt>
                  <dd>{order.customer.email}</dd>
                </>
              )}
              <dt>Адрес</dt>
              <dd>{order.address ? formatAddress(order.address) : 'Не указан'}</dd>
              {order.customerComment && (
                <>
                  <dt>Комментарий клиента</dt>
                  <dd>{order.customerComment}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="card mt-16">
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
            <h2>История заказа</h2>
            <ul className="timeline">
              {order.timeline.map((t, idx) => (
                <li key={idx}>
                  <div>
                    <strong>{t.status.nameRu}</strong>
                    <span className="muted small"> · {formatDate(t.createdAt)}</span>
                  </div>
                  {t.changedBy?.name && <div className="muted small">{t.changedBy.name}</div>}
                  {t.comment && <div className="small">{t.comment}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside>
          <div className="card">
            <h2>Действия</h2>
            {finished && <p className="muted small" style={{ margin: 0 }}>Заказ завершён, статус больше не меняется.</p>}
            {!finished && (
              <>
                {code === 'new' && <p className="muted small">Заказ создан, ждёт перехода к оплате.</p>}
                {code === 'awaiting_payment' && <p className="muted small">Ждём оплату клиента. Менеджер оплату не подтверждает: статус «Оплачен» ставится при оплате.</p>}
                {nextCode && (
                  <>
                    <div className="field">
                      <label htmlFor="m-comment">Комментарий к смене статуса (необязательно)</label>
                      <textarea id="m-comment" className="textarea" rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => moveTo(nextCode)}>
                      Перевести в «{STATUS_BY_CODE[nextCode].label}»
                    </button>
                  </>
                )}
                {canCancel && (
                  <div className="mt-16">
                    <div className="field">
                      <label htmlFor="m-cancel">Причина отмены</label>
                      <textarea id="m-cancel" className="textarea" rows={2} maxLength={1000} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-danger btn-block" disabled={busy || !cancelReason.trim()} onClick={cancelOrder}>
                      Отменить заказ
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card mt-16">
            <h2>Отправление</h2>
            {!canShip ? (
              <p className="muted small" style={{ margin: 0 }}>
                Трек-номер и вес можно указать после выкупа заказа.
              </p>
            ) : (
              <form onSubmit={saveShipment}>
                <div className="field">
                  <label htmlFor="s-track">Трек-номер</label>
                  <input id="s-track" className="input" maxLength={100} value={ship.trackingNumber} onChange={(e) => setShip((s) => ({ ...s, trackingNumber: e.target.value }))} />
                </div>
                <div className="field">
                  <label htmlFor="s-carrier">Перевозчик</label>
                  <select id="s-carrier" className="select" value={ship.carrier} onChange={(e) => setShip((s) => ({ ...s, carrier: e.target.value }))}>
                    <option value="">Не выбран</option>
                    {CARRIERS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="s-weight">Фактический вес, кг</label>
                  <input id="s-weight" className="input" type="number" min="0" max="1000" step="0.001" inputMode="decimal" value={ship.weightKg} onChange={(e) => setShip((s) => ({ ...s, weightKg: e.target.value }))} />
                </div>
                <p className="muted small">Фактический вес сохраняется для учёта и не меняет сумму заказа.</p>
                <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>
                  Сохранить отправление
                </button>
              </form>
            )}
          </div>

          <div className="card mt-16">
            <h2>Заметка менеджера</h2>
            <p className="muted small" style={{ marginTop: 0 }}>Видна только сотрудникам.</p>
            <textarea className="textarea" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className="btn btn-secondary btn-block mt-8" disabled={busy} onClick={saveNote}>
              Сохранить заметку
            </button>
          </div>

          <div className="card mt-16">
            <h2>Стоимость</h2>
            <div className="summary-row">
              <span>Товары в юанях</span>
              <span>{formatCny(order.subtotalCny)}</span>
            </div>
            <div className="summary-row">
              <span>Курс · комиссия</span>
              <span>
                {formatNumber(order.exchangeRate)} · {formatNumber(order.commissionPercent)}%
              </span>
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
          </div>

          <div className="card mt-16">
            <h2>Платежи</h2>
            {order.payments.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Платежей нет.
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