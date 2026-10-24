// Корзина: изменение количества, удаление позиций, итог в рублях по расчёту сервера.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import ProductImage from '../components/ProductImage.jsx';
import { formatCny, formatKg, formatNumber, formatRub } from '../utils/format.js';

function attributesText(attrs) {
  const entries = Object.entries(attrs || {});
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '';
}

export default function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get('/cart')
      .then((d) => alive && setCart(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function act(fn) {
    setBusy(true);
    setError('');
    try {
      setCart(await fn());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const changeQty = (item, q) => {
    if (q < 1 || q > 99) return;
    act(() => api.patch(`/cart/items/${item.id}`, { quantity: q }));
  };
  const remove = (item) => act(() => api.delete(`/cart/items/${item.id}`));
  const clear = () => {
    if (window.confirm('Очистить корзину?')) act(() => api.delete('/cart'));
  };

  if (loading) {
    return (
      <div className="center">
        <span className="spinner" />
      </div>
    );
  }

  const items = cart?.items || [];
  const totals = cart?.totals;
  const hasInactive = items.some((i) => !i.isActive);
  const hasPriceChange = items.some((i) => i.priceChanged);

  return (
    <>
      <h1 className="page-title">Корзина</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {items.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Корзина пуста.
          </p>
          <Link to="/catalog" className="btn btn-primary">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="card">
            {items.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-thumb">
                  <ProductImage url={item.mainImageUrl} name={item.name} />
                </div>
                <div>
                  <Link to={`/products/${item.productId}`} className="cart-name">
                    {item.name}
                  </Link>
                  <div className="muted small">
                    {item.marketplace.name} · {formatCny(item.priceCnyAtAdd)} за шт. · {formatKg(item.weightKg)}
                    {attributesText(item.selectedAttributes) && ` · ${attributesText(item.selectedAttributes)}`}
                  </div>
                  {item.priceChanged && (
                    <div className="small warn">Цена на площадке изменилась: сейчас {formatCny(item.currentPriceCny)}</div>
                  )}
                  {!item.isActive && <div className="small danger-text">Товар недоступен. Удалите его, чтобы оформить заказ.</div>}
                  <div className="row mt-8">
                    <div className="qty">
                      <button type="button" disabled={busy || item.quantity <= 1} onClick={() => changeQty(item, item.quantity - 1)} aria-label="Меньше">
                        −
                      </button>
                      <span className="qty-value">{item.quantity}</span>
                      <button type="button" disabled={busy || item.quantity >= 99} onClick={() => changeQty(item, item.quantity + 1)} aria-label="Больше">
                        +
                      </button>
                    </div>
                    <button type="button" className="link-btn" disabled={busy} onClick={() => remove(item)}>
                      Удалить
                    </button>
                  </div>
                </div>
                <div className="cart-total-cell">
                  <strong>{formatRub(item.lineTotalRub)}</strong>
                </div>
              </div>
            ))}
            <div className="mt-16">
              <button type="button" className="link-btn" disabled={busy} onClick={clear}>
                Очистить корзину
              </button>
            </div>
          </div>

          <aside className="card">
            <h2>Итого</h2>
            <div className="summary-row">
              <span>Товары ({items.reduce((s, i) => s + i.quantity, 0)} шт.)</span>
              <span>{formatRub(totals.itemsRub)}</span>
            </div>
            <div className="summary-row">
              <span>Вес посылки</span>
              <span>{formatKg(totals.totalWeightKg)}</span>
            </div>
            <div className="summary-row">
              <span>Доставка</span>
              <span>{formatRub(totals.deliveryRub)}</span>
            </div>
            <div className="summary-row summary-total">
              <span>К оплате</span>
              <span>{formatRub(totals.totalRub)}</span>
            </div>
            <p className="muted small">
              Курс {formatNumber(totals.exchangeRate)} ₽ за ¥, комиссия {formatNumber(totals.commissionPercent)}%. Расчёт по цене на момент добавления.
            </p>
            {hasPriceChange && <p className="small warn">Цена на площадке изменилась, итог пересчитывается при оформлении заказа.</p>}
            <button type="button" className="btn btn-primary btn-block" disabled={busy || hasInactive} onClick={() => navigate('/checkout')}>
              Оформить заказ
            </button>
          </aside>
        </div>
      )}
    </>
  );
}