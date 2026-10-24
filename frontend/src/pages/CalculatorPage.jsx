// Калькулятор стоимости: доступен без входа.
import { useState } from 'react';
import CalcPanel from '../components/CalcPanel.jsx';

export default function CalculatorPage() {
  const [form, setForm] = useState({ priceCny: '', quantity: 1, weightKg: '' });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <h1 className="page-title">Калькулятор стоимости</h1>
      <div className="cart-layout">
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Узнайте итоговую стоимость товара в рублях: цена в юанях по текущему курсу, комиссия сервиса и международная доставка по весу.
          </p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-price">Цена за штуку, ¥</label>
              <input id="c-price" className="input" type="number" min="0" step="0.01" inputMode="decimal" value={form.priceCny} onChange={set('priceCny')} />
            </div>
            <div className="field">
              <label htmlFor="c-qty">Количество</label>
              <input id="c-qty" className="input" type="number" min="1" max="99" step="1" value={form.quantity} onChange={set('quantity')} />
            </div>
            <div className="field">
              <label htmlFor="c-weight">Вес одной штуки, кг</label>
              <input id="c-weight" className="input" type="number" min="0" step="0.001" inputMode="decimal" value={form.weightKg} onChange={set('weightKg')} />
            </div>
          </div>
        </div>
        <aside>
          <CalcPanel priceCny={form.priceCny} quantity={form.quantity} weightKg={form.weightKg} />
        </aside>
      </div>
    </>
  );
}