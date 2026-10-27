// Начало добавления товара: поле для ссылки открывает форму с подставленным адресом.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractLink } from '../utils/linkInfo.js';
import { MARKETPLACES } from '../utils/marketplaces.js';

export default function CartEmpty({ compact = false }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');

  function go(e) {
    e.preventDefault();
    const link = extractLink(text);
    navigate(link ? `/add?link=${encodeURIComponent(link)}` : '/add');
  }

  const form = (
    <form className="link-form" onSubmit={go}>
      <input className="input" placeholder="Вставьте ссылку на товар" value={text} onChange={(e) => setText(e.target.value)} aria-label="Ссылка на товар" />
      <button type="submit" className="btn btn-primary">
        {compact ? 'Добавить ещё' : 'Добавить товар'}
      </button>
    </form>
  );

  if (compact) {
    return <div className="card cart-add">{form}</div>;
  }

  return (
    <div className="card cart-empty">
      <h2>Корзина пуста</h2>
      <p className="muted" style={{ margin: 0 }}>
        Вставьте ссылку на товар, остальное заполните в форме. Расчёт в рублях виден сразу.
      </p>
      {form}
      <div className="chips">
        {MARKETPLACES.map((m) => (
          <span className="chip" key={m.code}>
            {m.name}
          </span>
        ))}
      </div>
      <Link to="/docs/prohibited" className="small">
        Запрещённые товары к перевозке
      </Link>
    </div>
  );
}