// Картинка товара; если адреса нет или она не загрузилась, показывается буква-заглушка.
import { useState } from 'react';

export default function ProductImage({ url, name }) {
  const [failed, setFailed] = useState(false);
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="product-img">
      {url && !failed ? (
        <img src={url} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="img-placeholder">{letter}</span>
      )}
    </div>
  );
}