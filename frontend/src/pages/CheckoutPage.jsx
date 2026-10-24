// Оформление заказа: выбор адреса, комментарий, итог. Расчёт стоимости выполняет сервер.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import AddressForm from '../components/AddressForm.jsx';
import { formatAddress } from '../utils/address.js';
import { formatKg, formatNumber, formatRub } from '../utils/format.js';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([api.get('/cart'), api.get('/addresses')])
      .then(([c, a]) => {
        if (!alive) return;
        setCart(c);
        setAddresses(a.items);
        const def = a.items.find((x) => x.isDefault) || a.items[0];
        setSelected(def ? def.id : '');
        setShowForm(a.items.length === 0);
      })
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  function onAddressSaved(res) {
    setAddresses(res.items);
    setSelected(res.item.id);
    setShowForm(false);
  }

  async function submit() {
    if (!selected) {
      setError('Выберите адрес доставки');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const body = { addressId: selected };
      if (comment.trim()) body.customerComment = comment.trim();
      const order = await api.post('/orders', body);
      navigate(`/orders/${order.id}`, { state: { notice: 'Заказ оформлен. Оплатите его, чтобы мы приступили к выкупу.' } });
    } catch (e) {
      setError(errorMessage(e));
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

  const items = cart?.items || [];
  if (items.length === 0) {
    return (
      <div className="card">
        {error && <div className="alert alert-error">{error}</div>}
        <p className="muted" style={{ marginTop: 0 }}>
          В корзине нет товаров.
        </p>
        <Link to="/catalog" className="btn btn-primary">
          Перейти в каталог
        </Link>
      </div>
    );
  }
  const totals = cart.totals;
  const hasInactive = items.some((i) => !i.isActive);

  return (
    <>
      <h1 className="page-title">Оформление заказа</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {hasInactive && (
        <div className="alert alert-error">
          В корзине есть недоступные товары. <Link to="/cart">Вернитесь в корзину</Link> и удалите их.
        </div>
      )}

      <div className="cart-layout">
        <div>
          <div className="card">
            <h2>Адрес доставки</h2>
            {addresses.map((a) => (
              <label key={a.id} className={`radio-card${selected === a.id ? ' selected' : ''}`}>
                <input type="radio" name="address" checked={selected === a.id} onChange={() => setSelected(a.id)} />
                <span>
                  {formatAddress(a)}
                  {a.isDefault && <span className="badge badge-blue" style={{ marginLeft: 8 }}>По умолчанию</span>}
                </span>
              </label>
            ))}
            {showForm ? (
              <div className="mt-16">
                <AddressForm onSaved={onAddressSaved} onCancel={addresses.length > 0 ? () => setShowForm(false) : undefined} />
              </div>
            ) : (
              <button type="button" className="btn btn-secondary mt-16" onClick={() => setShowForm(true)}>
                Добавить адрес
              </button>
            )}
          </div>

          <div className="card mt-16">
            <h2>Комментарий к заказу</h2>
            <textarea className="textarea" rows={3} maxLength={1000} placeholder="Например: цвет, размер, пожелания к упаковке" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>

        <aside className="card">
          <h2>Ваш заказ</h2>
          {items.map((i) => (
            <div className="summary-row small" key={i.id}>
              <span>
                {i.name} × {i.quantity}
              </span>
              <span>{formatRub(i.lineTotalRub)}</span>
            </div>
          ))}
          <div className="summary-row mt-8">
            <span>Товары</span>
            <span>{formatRub(totals.itemsRub)}</span>
          </div>
          <div className="summary-row">
            <span>Доставка ({formatKg(totals.totalWeightKg)})</span>
            <span>{formatRub(totals.deliveryRub)}</span>
          </div>
          <div className="summary-row summary-total">
            <span>К оплате</span>
            <span>{formatRub(totals.totalRub)}</span>
          </div>
          <p className="muted small">
            Курс {formatNumber(totals.exchangeRate)} ₽ за ¥ и комиссия {formatNumber(totals.commissionPercent)}% фиксируются в момент оформления.
          </p>
          <button type="button" className="btn btn-primary btn-block" disabled={busy || hasInactive || showForm} onClick={submit}>
            {busy ? 'Оформляем…' : 'Подтвердить заказ'}
          </button>
          {showForm && <p className="muted small mt-8">Сохраните или отмените новый адрес.</p>}
        </aside>
      </div>
    </>
  );
}