// Форма нового адреса доставки. Сохраняет адрес на сервере и возвращает обновлённый список.
import { useState } from 'react';
import { api, errorMessage } from '../api/client.js';

const EMPTY = { country: 'Россия', region: '', city: '', street: '', building: '', apartment: '', postalCode: '', isDefault: false };

export default function AddressForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { country: form.country.trim() || 'Россия', city: form.city.trim(), street: form.street.trim(), building: form.building.trim(), isDefault: form.isDefault };
      ['region', 'apartment', 'postalCode'].forEach((key) => {
        if (form[key].trim()) body[key] = form[key].trim();
      });
      const res = await api.post('/addresses', body);
      onSaved(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="address-form">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ad-country">Страна</label>
          <input id="ad-country" className="input" value={form.country} onChange={set('country')} required />
        </div>
        <div className="field">
          <label htmlFor="ad-region">Регион (необязательно)</label>
          <input id="ad-region" className="input" value={form.region} onChange={set('region')} />
        </div>
        <div className="field">
          <label htmlFor="ad-city">Город</label>
          <input id="ad-city" className="input" value={form.city} onChange={set('city')} required />
        </div>
        <div className="field">
          <label htmlFor="ad-zip">Индекс (необязательно)</label>
          <input id="ad-zip" className="input" inputMode="numeric" value={form.postalCode} onChange={set('postalCode')} />
        </div>
        <div className="field">
          <label htmlFor="ad-street">Улица</label>
          <input id="ad-street" className="input" value={form.street} onChange={set('street')} required />
        </div>
        <div className="field">
          <label htmlFor="ad-building">Дом</label>
          <input id="ad-building" className="input" value={form.building} onChange={set('building')} required />
        </div>
        <div className="field">
          <label htmlFor="ad-apt">Квартира (необязательно)</label>
          <input id="ad-apt" className="input" value={form.apartment} onChange={set('apartment')} />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
        Сделать адресом по умолчанию
      </label>
      <div className="row mt-16">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить адрес'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}