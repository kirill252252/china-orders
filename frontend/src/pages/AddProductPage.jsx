// Добавление товара вручную: ссылку менеджер использует для проверки цены,
// справа живой расчёт стоимости, под категорией «светофор» ограничений перевозки.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import CalcPanel from '../components/CalcPanel.jsx';
import CategoryLight from '../components/CategoryLight.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { CATEGORIES, LEVEL_LABEL, assess, nameWarning } from '../utils/categories.js';
import { extractLink, guessMarketplace, safeHttpUrl } from '../utils/linkInfo.js';
import { MARKETPLACES } from '../utils/marketplaces.js';
import { clearDraft, loadDraft, saveDraft } from '../utils/draft.js';

export default function AddProductPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const startLink = params.get('link') || '';
  const [form, setForm] = useState(() => {
    const fresh = {
      link: startLink,
      marketplace: guessMarketplace(startLink),
      category: '',
      name: '',
      priceCny: '',
      weightKg: '',
      color: '',
      size: '',
      battery: '',
      note: '',
    };
  // Новая ссылка начинает чистую форму, иначе возвращаем незавершённый черновик
    const draft = startLink ? null : loadDraft(user?.id);
    return draft?.form ? { ...fresh, ...draft.form } : fresh;
  });
  const [quantity, setQuantity] = useState(() => (startLink ? 1 : loadDraft(user?.id)?.quantity || 1));
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user?.id) saveDraft(user.id, { form, quantity });
  }, [form, quantity, user?.id]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setLink = (e) => {
    const link = e.target.value;
    setForm((f) => ({ ...f, link, marketplace: guessMarketplace(link) || f.marketplace }));
  };
  const changeQuantity = (value) => {
    const n = Math.round(Number(value));
    if (!Number.isNaN(n)) setQuantity(Math.min(99, Math.max(1, n)));
  };

  const flagged = nameWarning(form.name);

  if (user?.role !== 'customer') {
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Добавлять товары в корзину могут только клиенты.
        </p>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const link = safeHttpUrl(extractLink(form.link));
    const price = Number(form.priceCny);
    const weight = Number(form.weightKg);
    if (!link) return setError('Вставьте ссылку на страницу товара, она начинается с https://');
    if (link.length > 1000) return setError('Ссылка слишком длинная: уберите лишние параметры после знака «?»');
    if (!form.marketplace) return setError('Выберите площадку');
    if (!form.category) return setError('Выберите категорию');
    if (!form.name.trim()) return setError('Укажите название товара');
    if (!(price > 0) || !(weight > 0)) return setError('Цена и вес должны быть больше нуля');
    if (!form.battery) return setError('Укажите, есть ли в товаре батарейка');
    if (!agree) return setError('Подтвердите согласие с правилами');

    setBusy(true);
    let product;
    try {
      product = await api.post('/products/manual', {
        marketplace: form.marketplace,
        name: form.name.trim(),
        priceCny: price,
        weightKg: weight,
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }

    clearDraft(user.id);

    const attrs = { category: form.category, battery: form.battery, link };
    if (form.color.trim()) attrs.color = form.color.trim();
    if (form.size.trim()) attrs.size = form.size.trim();
    if (form.note.trim()) attrs.note = form.note.trim();
    try {
      await api.post('/cart/items', { productId: String(product.id), quantity, selectedAttributes: attrs });
      navigate('/cart');
    } catch (err) {
      // Товар уже создан, повтор дал бы дубль: ведём на его карточку
      navigate(`/products/${product.id}`, { state: { notice: `Товар сохранён, но в корзину не добавлен: ${errorMessage(err)}` } });
    }
  }

  const guess = guessMarketplace(form.link);
  const guessName = MARKETPLACES.find((m) => m.code === guess)?.name;

  return (
    <>
      <p>
        <Link to="/cart">← В корзину</Link>
      </p>
      <h1 className="page-title">Добавление товара</h1>
      <p className="muted small">
        Укажите данные со страницы товара: по ним менеджер выкупит заказ.{' '}
        <Link to="/docs/prohibited" target="_blank" rel="noopener noreferrer">
          Запрещённые товары к перевозке
        </Link>
      </p>

      <form className="cart-layout" onSubmit={submit}>
        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label htmlFor="a-link">Ссылка на товар</label>
            <input id="a-link" className="input" placeholder="Ссылка с любой площадки" value={form.link} onChange={setLink} />
            {guessName && <span className="small muted">Похоже на {guessName}</span>}
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="a-mp">Площадка</label>
              <select id="a-mp" className="select" value={form.marketplace} onChange={set('marketplace')}>
                <option value="">Выберите площадку</option>
                {MARKETPLACES.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
              {!form.marketplace && form.link.trim() && (
                <span className="small muted">
                  По короткой ссылке площадку определить нельзя, выберите её вручную.
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="a-cat">Категория</label>
              <select id="a-cat" className="select" value={form.category} onChange={set('category')}>
                <option value="">Выберите категорию</option>
                {Object.entries(LEVEL_LABEL).map(([level, label]) => (
                  <optgroup key={level} label={label}>
                    {CATEGORIES.filter((c) => c.level === level).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="a-name">Название товара</label>
              <input id="a-name" className="input" maxLength={200} value={form.name} onChange={set('name')} />
            </div>
            <div className="field">
              <label htmlFor="a-price">Стоимость в юанях, ¥</label>
              <input id="a-price" className="input" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.priceCny} onChange={set('priceCny')} />
            </div>
            <div className="field">
              <label htmlFor="a-weight">Вес одной штуки, кг</label>
              <input id="a-weight" className="input" type="number" min="0.001" step="0.001" inputMode="decimal" value={form.weightKg} onChange={set('weightKg')} />
            </div>
            <div className="field">
              <label htmlFor="a-color">Цвет</label>
              <input id="a-color" className="input" placeholder="Как указано у продавца" maxLength={50} value={form.color} onChange={set('color')} />
            </div>
            <div className="field">
              <label htmlFor="a-size">Размер</label>
              <input id="a-size" className="input" placeholder="Как указано у продавца" maxLength={50} value={form.size} onChange={set('size')} />
            </div>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Если вес неизвестен, укажите примерный: менеджер уточнит его до выкупа.
          </p>

          <div className="row" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
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
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Батарейка</label>
              <div className="pills">
                <button type="button" className={`pill${form.battery === 'yes' ? ' active' : ''}`} onClick={() => setForm((f) => ({ ...f, battery: 'yes' }))}>
                  Да
                </button>
                <button type="button" className={`pill${form.battery === 'no' ? ' active' : ''}`} onClick={() => setForm((f) => ({ ...f, battery: 'no' }))}>
                  Нет
                </button>
              </div>
            </div>
          </div>

          <CategoryLight category={form.category} battery={form.battery} />
          {flagged && (
            <div className="light light-limited" role="status">
              <strong>Проверьте, что товар разрешён</strong>
              <span>В названии есть слово из списка ограниченных или запрещённых товаров. Менеджер проверит заказ до выкупа.</span>
              <Link to="/docs/prohibited" target="_blank" rel="noopener noreferrer">
                Список запрещённых товаров
              </Link>
            </div>
          )}
          <div className="field">
            <label htmlFor="a-note">Заметка для менеджера</label>
            <textarea id="a-note" className="textarea" rows={2} maxLength={300} placeholder="Например: кому предназначен товар" value={form.note} onChange={set('note')} />
          </div>
        </div>

        <aside>
          <CalcPanel priceCny={form.priceCny} quantity={quantity} weightKg={form.weightKg} title="Расчёт" />
          <div className="card mt-16">
            <label className="check" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 4 }} />
              <span className="small">
                Я прочитал(а) и согласен(на) с{' '}
                <Link to="/docs/rules" target="_blank" rel="noopener noreferrer">
                  правилами оказания услуг
                </Link>
                . Товары представлены на сторонних площадках, сервис выступает посредником и не гарантирует подлинность или соответствие описанию. Если цена на площадке отличается, менеджер свяжется со мной до выкупа.
              </span>
            </label>
            <div className="row mt-16">
              <Link to="/cart" className="btn btn-secondary">
                Назад
              </Link>
              <button type="submit" className="btn btn-primary" disabled={busy || !agree}>
                {busy ? 'Добавляем…' : 'Добавить в корзину'}
              </button>
            </div>
          </div>
        </aside>
      </form>
    </>
  );
}
