// Главная: вставка ссылки на товар. Клиенту дополнительно показываются счётчики и последние заказы.
// Менеджер и администратор перенаправляются на свои разделы.
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatRub } from '../utils/format.js';
import { MARKETPLACES } from '../utils/marketplaces.js';
import { homeFor } from '../utils/roles.js';

const UNPAID = ['new', 'awaiting_payment'];
const IN_WORK = ['paid', 'purchased', 'shipped_from_china', 'in_transit', 'arrived_warehouse'];

function LinkForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      setError('Вставьте полную ссылку на товар, начиная с https://');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/products/import', { url: url.trim() });
      navigate(`/products/${res.id}`, {
        state: { notice: res.created ? 'Товар загружен по ссылке и добавлен в каталог.' : 'Этот товар уже есть в каталоге.' },
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="card hero">
      <h1 className="page-title">Начать покупки</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Вставьте ссылку на товар с китайской площадки: мы загрузим карточку и посчитаем стоимость в рублях.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      <form className="link-form" onSubmit={onSubmit}>
        <input
          className="input"
          inputMode="url"
          placeholder="Вставьте ссылку с Taobao, Tmall, 1688, JD, Pinduoduo или Poizon"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required={Boolean(user)}
          aria-label="Ссылка на товар"
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Загружаем…' : user ? 'Начать покупки' : 'Войти и начать'}
        </button>
      </form>
      <div className="chips">
        {MARKETPLACES.map((m) => (
          <span key={m.code} className="chip">
            {m.name}
          </span>
        ))}
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Нет ссылки? <Link to={user ? '/add' : '/login'}>Введите данные товара вручную</Link> или{' '}
        <Link to="/catalog">посмотрите добавленные товары</Link>.
      </p>
    </div>
  );
}

function Dashboard() {
  const [orders, setOrders] = useState(null);
  const [cartCount, setCartCount] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get('/orders', { limit: 50 })
      .then((d) => alive && setOrders(d))
      .catch((e) => alive && setError(errorMessage(e)));
    api
      .get('/cart')
      .then((c) => alive && setCartCount(c.items.length))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="alert alert-error mt-16">{error}</div>;
  if (!orders) {
    return (
      <div className="center">
        <span className="spinner" />
      </div>
    );
  }

  // Счётчики считаются по последним 50 заказам; плюс означает, что заказов больше
  const more = orders.total > orders.items.length;
  const count = (codes) => orders.items.filter((o) => codes.includes(o.status.code)).length;
  const show = (n) => (n > 0 && more ? `${n}+` : n);

  const stats = [
    { to: '/cart', label: 'Позиций в корзине', value: cartCount ?? '–' },
    { to: '/orders', label: 'Ждут оплаты', value: show(count(UNPAID)) },
    { to: '/orders', label: 'В работе', value: show(count(IN_WORK)) },
    { to: '/orders', label: 'Всего заказов', value: orders.total },
  ];

  return (
    <>
      <div className="stat-grid">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="muted small">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="card mt-16">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Последние заказы</h2>
          {orders.items.length > 0 && <Link to="/orders">Все заказы</Link>}
        </div>
        {orders.items.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Заказов пока нет. Вставьте ссылку на товар выше, добавьте его в корзину и оформите первый заказ.
          </p>
        ) : (
          <div className="table-wrap mt-8">
            <table className="table">
              <tbody>
                {orders.items.slice(0, 5).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`}>{o.orderNumber}</Link>
                    </td>
                    <td className="muted small">{formatDate(o.createdAt)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatRub(o.totalRub)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="center">
        <span className="spinner" />
      </div>
    );
  }
  if (user && user.role !== 'customer') return <Navigate to={homeFor(user.role)} replace />;
  return (
    <>
      <LinkForm />
      {user && <Dashboard />}
    </>
  );
}