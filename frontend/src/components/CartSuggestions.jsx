// Подборка под корзиной: товары из последнего заказа клиента.
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function CartSuggestions({ exclude, busy, onAdd }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await api.get('/orders', { page: 1, limit: 1 });
        if (list.items.length === 0) return;
        const order = await api.get(`/orders/${list.items[0].id}`);
        const items = order.items.map((i) => ({
          id: String(i.productId),
          name: i.name,
          quantity: i.quantity,
          attrs: i.selectedAttributes || {},
        }));
        if (alive) setState({ note: `Из заказа ${order.orderNumber}`, items });
      } catch {
        // Подборка необязательна: при ошибке блок не показываем
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;
  const list = state.items.filter((i) => !exclude.includes(i.id)).slice(0, 4);
  if (list.length === 0) return null;

  return (
    <section className="suggest">
      <div className="suggest-head">
        <h2>Заказывали раньше</h2>
        <span className="muted small">{state.note}</span>
      </div>
      <div className="mini-grid">
        {list.map((i) => (
          <div className="mini" key={i.id}>
            <div className="mini-body">
              <div className="mini-name" title={i.name}>
                {i.name}
              </div>
              <div className="muted small">× {i.quantity}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onAdd(i.id, i.quantity, i.attrs)}>
              Снова
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}