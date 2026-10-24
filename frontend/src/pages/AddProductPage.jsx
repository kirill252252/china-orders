// Добавление товара: по ссылке или вручную. В ручной форме справа живой расчёт стоимости.
// Клиент может сразу положить товар в корзину с цветом, размером и количеством.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import CalcPanel from '../components/CalcPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { MARKETPLACES } from '../utils/marketplaces.js';

const EMPTY = { marketplace: 'taobao', name: '', priceCny: '', weightKg: '', color: '', size: '', note: '', description: '' };

export default function AddProductPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCustomer = user?.role === 'customer';
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [manual, setManual] = useState(EMPTY);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setM = (key) => (e) => setManual((f) => ({ ...f, [key]: e.target.value }));
  const changeQuantity = (value) => {
    const n = Math.round(Number(value));
    if (!Number.isNaN(n)) setQuantity(Math.min(99, Math.max(1, n)));
  };
  const switchTab = (next) => {
    setTab(next);
    setError('');
  };

  async function submitUrl(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/products/import', { url: url.trim() });
      navigate(`/products/${res.id}`, {
        state: { notice: res.created ? 'Товар загружен и добавлен в ваш список.' : 'Этот товар уже есть в каталоге, он добавлен в ваш список.' },
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function submitManual(toCart) {
    setError('');
    const price = Number(manual.priceCny);
    const weight = Number(manual.weightKg);
    if (!manual.name.trim()) {
      setError('Укажите название товара');
      return;
    }
    if (!(price > 0) || !(weight > 0)) {
      setError('Цена и вес должны быть больше нуля');
      return;
    }
    setBusy(true);
    let product;
    try {
      const description = [manual.description.trim(), manual.note.trim() && `Заметка: ${manual.note.trim()}`].filter(Boolean).join('\n');
      product = await api.post('/products/manual', {
        marketplace: manual.marketplace,
        name: manual.name.trim(),
        priceCny: price,
        weightKg: weight,
        description,
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }

    if (!toCart) {
      navigate(`/products/${product.id}`, { state: { notice: 'Товар сохранён в ваш список.' } });
      return;
    }
    const attrs = {};
    if (manual.color.trim()) attrs.color = manual.color.trim();
    if (manual.size.trim()) attrs.size = manual.size.trim();
    try {
      await api.post('/cart/items', { productId: String(product.id), quantity, selectedAttributes: attrs });
      navigate('/cart');
    } catch (err) {
      // Товар уже создан, повторная отправка дала бы дубль: ведём на его карточку
      navigate(`/products/${product.id}`, { state: { notice: `Товар сохранён, но в корзину не добавлен: ${errorMessage(err)}` } });
    }
  }

  return (
    <>
      <p>
        <Link to="/catalog">← К товарам</Link>
      </p>
      <h1 className="page-title">Добавить товар</h1>
      <div className="tabs">
        <button type="button" className={`tab${tab === 'url' ? ' active' : ''}`} onClick={() => switchTab('url')}>
          По ссылке
        </button>
        <button type="button" className={`tab${tab === 'manual' ? ' active' : ''}`} onClick={() => switchTab('manual')}>
          Вручную
        </button>
      </div>

      <div className={tab === 'manual' ? 'cart-layout' : ''}>
        <div className="card" style={tab === 'url' ? { maxWidth: 720 } : undefined}>
          {error && <div className="alert alert-error">{error}</div>}

          {tab === 'url' ? (
            <form onSubmit={submitUrl}>
              <div className="field">
                <label htmlFor="a-url">Ссылка на товар</label>
                <input id="a-url" className="input" type="url" required placeholder="https://detail.1688.com/offer/123456789.html" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <p className="muted small">
                Поддерживаются Taobao, Tmall, 1688, Pinduoduo, JD и Poizon. Данные товара загружаются автоматически (в учебной версии это демонстрационные данные). Если ссылку не удалось разобрать, заполните карточку вручную.
              </p>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Загружаем…' : 'Добавить по ссылке'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitManual(false);
              }}
            >
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="m-mp">Маркетплейс</label>
                  <select id="m-mp" className="select" value={manual.marketplace} onChange={setM('marketplace')}>
                    {MARKETPLACES.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="m-name">Название (до 200 символов)</label>
                  <input id="m-name" className="input" required maxLength={200} value={manual.name} onChange={setM('name')} />
                </div>
                <div className="field">
                  <label htmlFor="m-price">Стоимость в юанях, ¥</label>
                  <input id="m-price" className="input" type="number" min="0.01" step="0.01" required inputMode="decimal" value={manual.priceCny} onChange={setM('priceCny')} />
                </div>
                <div className="field">
                  <label htmlFor="m-weight">Вес одной штуки, кг</label>
                  <input id="m-weight" className="input" type="number" min="0.001" step="0.001" required inputMode="decimal" value={manual.weightKg} onChange={setM('weightKg')} />
                </div>
                <div className="field">
                  <label htmlFor="m-color">Цвет</label>
                  <input id="m-color" className="input" placeholder="Как указано у продавца" maxLength={50} value={manual.color} onChange={setM('color')} />
                </div>
                <div className="field">
                  <label htmlFor="m-size">Размер</label>
                  <input id="m-size" className="input" placeholder="Как указано у продавца" maxLength={50} value={manual.size} onChange={setM('size')} />
                </div>
              </div>

              <div className="field">
                <label>Количество</label>
                <div className="qty">
                  <button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Меньше">
                    −
                  </button>
                  <input type="number" min="1" max="99" value={quantity} onChange={(e) => changeQuantity(e.target.value)} />
                  <button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= 99} aria-label="Больше">
                    +
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="m-desc">Описание (необязательно)</label>
                <textarea id="m-desc" className="textarea" rows={3} maxLength={1500} value={manual.description} onChange={setM('description')} />
              </div>
              <div className="field">
                <label htmlFor="m-note">Заметка для менеджера (необязательно)</label>
                <textarea id="m-note" className="textarea" rows={2} maxLength={300} placeholder="Например: кому предназначен товар" value={manual.note} onChange={setM('note')} />
              </div>

              <div className="row">
                <button type="submit" className="btn btn-secondary" disabled={busy}>
                  Сохранить в список
                </button>
                {isCustomer && (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => submitManual(true)}>
                    {busy ? 'Сохраняем…' : 'Добавить в корзину'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {tab === 'manual' && (
          <aside>
            <CalcPanel priceCny={manual.priceCny} quantity={quantity} weightKg={manual.weightKg} title="Расчёт" />
          </aside>
        )}
      </div>
    </>
  );
}