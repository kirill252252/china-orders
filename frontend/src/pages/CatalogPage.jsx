// Каталог: поиск, фильтры, сортировка и пагинация. Состояние хранится в адресной строке.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';
import { MARKETPLACES } from '../utils/marketplaces.js';

const LIMIT = 12;
const SORTS = [
  { value: 'newest', label: 'Сначала новые' },
  { value: 'price_asc', label: 'Сначала дешёвые' },
  { value: 'price_desc', label: 'Сначала дорогие' },
];

function readForm(params) {
  return {
    q: params.get('q') || '',
    marketplace: params.get('marketplace') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    sort: params.get('sort') || 'newest',
  };
}

export default function CatalogPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(() => readForm(params));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const requestId = useRef(0);
  const [deletingId, setDeletingId] = useState(null);

  const query = params.toString();
  const page = Number(params.get('page')) || 1;

  useEffect(() => {
    const id = ++requestId.current;
    const sp = new URLSearchParams(query);
    setForm(readForm(sp));
    setLoading(true);
    setError('');
    api
      .get(user?.role === 'customer' ? '/products/mine' : '/products', {
        page: sp.get('page') || 1,
        limit: LIMIT,
        marketplace: sp.get('marketplace'),
        q: sp.get('q'),
        minPrice: sp.get('minPrice'),
        maxPrice: sp.get('maxPrice'),
        sort: sp.get('sort'),
      })
      .then((d) => id === requestId.current && setData(d))
      .catch((e) => id === requestId.current && setError(errorMessage(e)))
      .finally(() => id === requestId.current && setLoading(false));
  }, [query, user?.role]);

  function apply(next, nextPage = 1) {
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      if (key === 'sort' && value === 'newest') return;
      sp.set(key, String(value).trim());
    });
    if (nextPage > 1) sp.set('page', String(nextPage));
    setParams(sp);
  }

  function onSubmit(e) {
    e.preventDefault();
    const min = form.minPrice === '' ? null : Number(form.minPrice);
    const max = form.maxPrice === '' ? null : Number(form.maxPrice);
    if ((min !== null && (Number.isNaN(min) || min < 0)) || (max !== null && (Number.isNaN(max) || max < 0))) {
      setFormError('Цена должна быть неотрицательным числом');
      return;
    }
    if (min !== null && max !== null && min > max) {
      setFormError('Минимальная цена больше максимальной');
      return;
    }
    setFormError('');
    apply(form);
  }

  function reset() {
    setFormError('');
    setParams(new URLSearchParams());
  }



  async function removeProduct(productId) {
    if (!window.confirm('Убрать товар из своего каталога?')) return;

    setDeletingId(productId);
    setError('');

    try {
      await api.delete(`/products/mine/${productId}`);

      const remaining = (data?.items.length ?? 0) - 1;

      if (remaining === 0 && page > 1) {
        apply(form, page - 1);
        return;
      }

      setData((current) => {
        if (!current) return current;

        const total = Math.max(0, current.total - 1);

        return {
          ...current,
          items: current.items.filter((p) => p.id !== productId),
          total,
          totalPages: Math.ceil(total / LIMIT),
        };
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDeletingId(null);
    }
  }
  
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Товары
        </h1>
        {user && (
          <Link to="/add" className="btn btn-primary">
            Добавить товар
          </Link>
        )}
      </div>

      <form className="card filters" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="f-q">Поиск</label>
          <input id="f-q" className="input" placeholder="Название товара" value={form.q} onChange={set('q')} />
        </div>
        <div className="field">
          <label htmlFor="f-mp">Маркетплейс</label>
          <select id="f-mp" className="select" value={form.marketplace} onChange={set('marketplace')}>
            <option value="">Все</option>
            {MARKETPLACES.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-min">Цена от, ¥</label>
          <input id="f-min" className="input" type="number" min="0" step="any" value={form.minPrice} onChange={set('minPrice')} />
        </div>
        <div className="field">
          <label htmlFor="f-max">Цена до, ¥</label>
          <input id="f-max" className="input" type="number" min="0" step="any" value={form.maxPrice} onChange={set('maxPrice')} />
        </div>
        <div className="field">
          <label htmlFor="f-sort">Сортировка</label>
          <select id="f-sort" className="select" value={form.sort} onChange={set('sort')}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="row filters-actions">
          <button type="submit" className="btn btn-primary">
            Применить
          </button>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            Сбросить
          </button>
        </div>
      </form>

      {formError && <div className="alert alert-error">{formError}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {loading && !data ? (
        <div className="center">
          <span className="spinner" />
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Ничего не найдено. Измените условия поиска или{' '}
            {user ? <Link to="/add">добавьте товар по ссылке</Link> : <Link to="/login">войдите, чтобы добавить товар</Link>}.
          </p>
        </div>
      ) : (
        data && (
          <>
            <p className="muted small">Найдено товаров: {data.total}</p>
            <div className={`product-grid${loading ? ' is-loading' : ''}`}>
              {data.items.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onDelete={user?.role === 'customer' ? removeProduct : undefined}
                  deleting={deletingId === p.id}
                />
              ))}
            </div>
            <Pagination page={page} totalPages={data.totalPages} onChange={(p) => apply(form, p)} />
          </>
        )
      )}
    </>
  );
}