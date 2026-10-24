// Карточка товара в каталоге.
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import { formatCny, formatKg } from '../utils/format.js';

export default function ProductCard({ product, onDelete, deleting = false }) {
  return (
    <div className="product-card">
      <Link to={`/products/${product.id}`} className="product-card-link">
        <ProductImage url={product.mainImageUrl} name={product.name} />
        <div className="product-body">
          <span className="badge badge-blue">{product.marketplace.name}</span>
          <div className="product-name">{product.name}</div>
          <div className="product-price">{formatCny(product.priceCny)}</div>
          <div className="muted small">{formatKg(product.weightKg)}</div>
        </div>
      </Link>

      {onDelete && (
        <div className="product-body">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deleting}
            onClick={() => onDelete(product.id)}
          >
            {deleting ? 'Удаление...' : 'Убрать из каталога'}
          </button>
        </div>
      )}
    </div>
  );
}