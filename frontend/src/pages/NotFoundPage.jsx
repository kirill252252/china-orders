import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="card">
      <h1 className="page-title">Страница не найдена</h1>
      <p className="muted">Такой страницы нет. Проверьте адрес или вернитесь на главную.</p>
      <Link to="/" className="btn btn-primary">
        На главную
      </Link>
    </div>
  );
}