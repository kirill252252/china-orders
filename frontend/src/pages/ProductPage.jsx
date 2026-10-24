// Карточка товара: описание, цена, добавление в корзину (для клиента).
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { formatCny, formatKg } from '../utils/format.js';
import CalcPanel from '../components/CalcPanel.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setProduct(null);
    setAdded(false);
    api
      .get(`/products/${id}`)
      .then((d) => alive && setProduct(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  async function addToCart() {
    setBusy(true);
    setAddError('');
    setAdded(false);
    try {
      const attrs = {};
      if (color.trim()) attrs.color = color.trim();
      if (size.trim()) attrs.size = size.trim();
      await api.post('/cart/items', { productId: String(product.id), quantity, selectedAttributes: attrs });
      setAdded(true);
    } catch (e) {
      setAddError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function changeQuantity(value) {
    const n = Math.round(Number(value));
    if (Number.isNaN(n)) return;
    setQuantity(Math.min(99, Math.max(1, n)));
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
        <Link to="/catalog" className="btn btn-secondary">
          В каталог
        </Link>
      </div>
    );
  }

  const notice = location.state?.notice;

  return (
    <>
      <p>
        <Link to="/catalog">← В каталог</Link>
      </p>
      {notice && <div className="alert alert-success">{notice}</div>}
      <div className="card product-detail">
        <ProductImage url={product.mainImageUrl} name={product.name} />
        <div>
          <span className="badge badge-blue">{product.marketplace.name}</span>
          <h1 className="page-title" style={{ marginTop: 10 }}>
            {product.name}
          </h1>
          <div className="product-price big">{formatCny(product.priceCny)}</div>
          <p className="muted">Вес: {formatKg(product.weightKg)}</p>
          {product.description && <p>{product.description}</p>}
          <p className="muted small">Артикул на площадке: {product.externalId}</p>

          {user?.role === 'customer' && (
            <div className="mt-16">
              {added && (
                <div className="alert alert-success">
                  Товар добавлен в корзину. <Link to="/cart">Перейти в корзину</Link>
                </div>
              )}
              {addError && <div className="alert alert-error">{addError}</div>}
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="p-color">Цвет</label>
                  <input id="p-color" className="input" placeholder="Как у продавца" maxLength={50} value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="p-size">Размер</label>
                  <input id="p-size" className="input" placeholder="Как у продавца" maxLength={50} value={size} onChange={(e) => setSize(e.target.value)} />
                </div>
              </div>
              <div className="row">
                <div className="qty">
                  <button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Меньше">
                    −
                  </button>
                  <input type="number" min="1" max="99" value={quantity} onChange={(e) => changeQuantity(e.target.value)} />
                  <button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= 99} aria-label="Больше">
                    +
                  </button>
                </div>
                <button type="button" className="btn btn-primary" onClick={addToCart} disabled={busy}>
                  {busy ? 'Добавляем…' : 'В корзину'}
                </button>
              </div>
            </div>
          )}
          {!user && (
            <p className="mt-16">
              <Link to="/login">Войдите</Link>, чтобы добавить товар в корзину.
            </p>
          )}
          {user && user.role !== 'customer' && <p className="muted mt-16">Корзина доступна клиентам.</p>}
          <div className="mt-16">
            <CalcPanel priceCny={product.priceCny} quantity={quantity} weightKg={product.weightKg} />
          </div>
        </div>
      </div>
    </>
  );
}