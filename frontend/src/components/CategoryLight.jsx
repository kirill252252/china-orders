// «Светофор» ограничений перевозки по выбранной категории.
import { Link } from 'react-router-dom';
import { assess } from '../utils/categories.js';

const TITLES = { ok: 'Можно заказывать', limited: 'Принимаем по условиям', banned: 'Запрещено к перевозке' };

export default function CategoryLight({ category, battery }) {
  const verdict = assess(category, battery);
  if (!verdict) return null;
  return (
    <div className={`light light-${verdict.level}`} role="status">
      <strong>{TITLES[verdict.level]}</strong>
      {verdict.hint && <span>{verdict.hint}</span>}
      <Link to="/docs/prohibited" target="_blank" rel="noopener noreferrer">
        Список запрещённых товаров
      </Link>
    </div>
  );
}