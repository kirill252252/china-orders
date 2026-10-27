// Корзина: шаги, пустое состояние со ссылкой, позиции, расчёт и подборка товаров.
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import CartEmpty from '../components/CartEmpty.jsx';
import CartSuggestions from '../components/CartSuggestions.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { formatCny, formatKg, formatNumber, formatRub } from '../utils/format.js';
import { attributesText } from '../utils/attributes.js';
import { safeHttpUrl } from '../utils/linkInfo.js';

const STEPS = ['Ссылка', 'Расчёт', 'Заказ'];

function Steps({ current }) {
  return (
    <div className="steps" aria-label="Шаги оформления">
      {STEPS.map((label, i) => (
        <Fragment key={label}>
          <span className={`step${i < current ? ' done' : ''}${i === current ? ' active' : ''}`}>
            <b>{i < current ? '✓' : i + 1}</b>
            {label}
          </span>
          {i < STEPS.length - 1 && <span className="step-line" />}
        </Fragment>
      ))}
    </div>
  );
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

  // Корзина лежит на сервере: при возврате на вкладку или в окно подтягиваем свежие данные.
  const busyRef = useRef(false);
  const lastSync = useRef(0);
  busyRef.current = busy;

  useEffect(() => {
    let alive = true;

    function sync() {
      if (document.visibilityState !== 'visible' || busyRef.current) return;
      if (Date.now() - lastSync.current < 1000) return;

      lastSync.current = Date.now();
      api
        .get('/cart')
        .then((data) => {
          if (alive && !busyRef.current) setCart(data);
        })
        .catch(() => {});
    }

    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
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

  const reload = () => act(() => api.get('/cart'));

  const addProduct = (productId, quantity, attrs) =>
    act(async () => {
      await api.post('/cart/items', {
        productId: String(productId),
        quantity,
        selectedAttributes: attrs || {},
      });
      return api.get('/cart');
    });

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
  const cartIds = items.map((i) => String(i.productId));

  // Расчёт для блока «Как считается»: юани → рубли по курсу, комиссия, доставка.
  const yuan = items.reduce((s, i) => s + i.priceCnyAtAdd * i.quantity, 0);
  const baseRub = totals ? yuan * totals.exchangeRate : 0;
  const commissionRub = totals ? (baseRub * totals.commissionPercent) / 100 : 0;

  return (
    <>
      <h1 className="page-title">Корзина</h1>
      <Steps current={items.length === 0 ? 0 : 1} />
      {error && <div className="alert alert-error">{error}</div>}

      {items.length === 0 ? (
        <>
          <CartEmpty onAdded={reload} />
          <CartSuggestions exclude={cartIds} busy={busy} onAdd={addProduct} />
        </>
      ) : (
        <div className="cart-layout">
          <div>
            <CartEmpty compact onAdded={reload} />
            <div className="card" style={{ marginTop: 12 }}>
              {items.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-thumb">
                    <ProductImage url={item.mainImageUrl} name={item.name} />
                  </div>
                  <div>
                    {safeHttpUrl(item.selectedAttributes?.link) && (
                      <div className="small">
                        <a
                          href={safeHttpUrl(item.selectedAttributes.link)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ссылка на товар
                        </a>
                      </div>
                    )}
                    <Link to={`/products/${item.productId}`} className="cart-name">
                      {item.name}
                    </Link>
                    <div className="muted small">
                      {item.marketplace.name} · {formatCny(item.priceCnyAtAdd)} за шт. · {formatKg(item.weightKg)}
                      {attributesText(item.selectedAttributes) && ` · ${attributesText(item.selectedAttributes)}`}
                    </div>
                    {item.priceChanged && (
                      <div className="small warn">
                        Цена на площадке изменилась: сейчас {formatCny(item.currentPriceCny)}
                      </div>
                    )}
                    {!item.isActive && (
                      <div className="small danger-text">
                        Товар недоступен. Удалите его, чтобы оформить заказ.
                      </div>
                    )}
                    <div className="row mt-8">
                      <div className="qty">
                        <button
                          type="button"
                          disabled={busy || item.quantity <= 1}
                          onClick={() => changeQty(item, item.quantity - 1)}
                          aria-label="Меньше"
                        >
                          −
                        </button>
                        <span className="qty-value">{item.quantity}</span>
                        <button
                          type="button"
                          disabled={busy || item.quantity >= 99}
                          onClick={() => changeQty(item, item.quantity + 1)}
                          aria-label="Больше"
                        >
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
              <div className="mt-16 row" style={{ justifyContent: 'space-between' }}>
                <button type="button" className="link-btn" disabled={busy} onClick={clear}>
                  Очистить корзину
                </button>
                <Link to="/add" className="small">
                  Добавить вручную
                </Link>
              </div>
            </div>
            <CartSuggestions exclude={cartIds} busy={busy} onAdd={addProduct} />
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

            <details className="calc-details">
              <summary>Как считается</summary>
              <div className="summary-row small">
                <span className="muted">Товары в юанях</span>
                <span>{formatCny(yuan)}</span>
              </div>
              <div className="summary-row small">
                <span className="muted">По курсу {formatNumber(totals.exchangeRate)} ₽ за ¥</span>
                <span>{formatRub(baseRub)}</span>
              </div>
              <div className="summary-row small">
                <span className="muted">Комиссия {formatNumber(totals.commissionPercent)}%</span>
                <span>{formatRub(commissionRub)}</span>
              </div>
              <div className="summary-row small">
                <span className="muted">Доставка по весу</span>
                <span>{formatRub(totals.deliveryRub)}</span>
              </div>
            </details>

            <p className="muted small">
              Расчёт по цене на момент добавления. Строки в раскрытом блоке округляются, итог считает сервер.
            </p>
            {hasPriceChange && (
              <p className="small warn">
                Цена на площадке изменилась, итог пересчитывается при оформлении заказа.
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy || hasInactive}
              onClick={() => navigate('/checkout')}
            >
              Оформить заказ
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
