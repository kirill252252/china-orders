// Тарифы доставки: список, создание, правка и отключение (удаления нет, на тарифы ссылаются заказы).
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import { formatNumber, formatRub } from '../../utils/format.js';

const EMPTY = { name: '', minWeightKg: '', maxWeightKg: '', baseCostRub: '', perKgCostRub: '', minDays: '', maxDays: '', isActive: true };

function toForm(t) {
  return {
    name: t.name,
    minWeightKg: String(t.minWeightKg),
    maxWeightKg: t.maxWeightKg === null ? '' : String(t.maxWeightKg),
    baseCostRub: String(t.baseCostRub),
    perKgCostRub: String(t.perKgCostRub),
    minDays: String(t.minDays),
    maxDays: String(t.maxDays),
    isActive: t.isActive,
  };
}

export default function AdminTariffs() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get('/admin/tariffs')
      .then((d) => alive && setItems(Array.isArray(d) ? d : d.items))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [reload]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function startEdit(t) {
    setEditId(t.id);
    setForm(toForm(t));
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY);
    setError('');
  }

  function buildBody() {
    const num = (v) => Number(v);
    const body = {
      name: form.name.trim(),
      minWeightKg: num(form.minWeightKg),
      maxWeightKg: form.maxWeightKg === '' ? null : num(form.maxWeightKg),
      baseCostRub: num(form.baseCostRub),
      perKgCostRub: num(form.perKgCostRub),
      minDays: num(form.minDays),
      maxDays: num(form.maxDays),
      isActive: form.isActive,
    };
    if (!body.name) return { error: 'Укажите название тарифа' };
    const numbers = [body.minWeightKg, body.baseCostRub, body.perKgCostRub, body.minDays, body.maxDays];
    if (form.minWeightKg === '' || form.baseCostRub === '' || form.perKgCostRub === '' || form.minDays === '' || form.maxDays === '' || numbers.some((n) => Number.isNaN(n) || n < 0)) {
      return { error: 'Заполните все числовые поля неотрицательными значениями' };
    }
    if (body.maxWeightKg !== null && !(body.maxWeightKg > body.minWeightKg)) return { error: 'Верхняя граница веса должна быть больше нижней' };
    if (body.maxDays < body.minDays) return { error: 'Максимум дней не может быть меньше минимума' };
    return { body };
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    const { body, error: validation } = buildBody();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      if (editId) await api.patch(`/admin/tariffs/${editId}`, body);
      else await api.post('/admin/tariffs', body);
      setNotice(editId ? 'Тариф сохранён.' : 'Тариф создан.');
      setEditId(null);
      setForm(EMPTY);
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(t) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api.patch(`/admin/tariffs/${t.id}`, { isActive: !t.isActive });
      setNotice(t.isActive ? 'Тариф отключён.' : 'Тариф включён.');
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>{editId ? 'Изменить тариф' : 'Новый тариф'}</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Стоимость доставки = базовая стоимость + вес посылки × цена за килограмм. Интервалы активных тарифов не должны пересекаться: нижняя граница включается, верхняя нет.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="t-name">Название</label>
              <input id="t-name" className="input" maxLength={100} value={form.name} onChange={set('name')} required />
            </div>
            <div className="field">
              <label htmlFor="t-min">Вес от, кг</label>
              <input id="t-min" className="input" type="number" min="0" step="0.001" value={form.minWeightKg} onChange={set('minWeightKg')} required />
            </div>
            <div className="field">
              <label htmlFor="t-max">Вес до, кг (пусто = без ограничения)</label>
              <input id="t-max" className="input" type="number" min="0" step="0.001" value={form.maxWeightKg} onChange={set('maxWeightKg')} />
            </div>
            <div className="field">
              <label htmlFor="t-base">Базовая стоимость, ₽</label>
              <input id="t-base" className="input" type="number" min="0" step="0.01" value={form.baseCostRub} onChange={set('baseCostRub')} required />
            </div>
            <div className="field">
              <label htmlFor="t-kg">Цена за кг, ₽</label>
              <input id="t-kg" className="input" type="number" min="0" step="0.01" value={form.perKgCostRub} onChange={set('perKgCostRub')} required />
            </div>
            <div className="field">
              <label htmlFor="t-dmin">Срок от, дней</label>
              <input id="t-dmin" className="input" type="number" min="0" step="1" value={form.minDays} onChange={set('minDays')} required />
            </div>
            <div className="field">
              <label htmlFor="t-dmax">Срок до, дней</label>
              <input id="t-dmax" className="input" type="number" min="0" step="1" value={form.maxDays} onChange={set('maxDays')} required />
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Тариф активен
          </label>
          <div className="row mt-16">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {editId ? 'Сохранить' : 'Создать тариф'}
            </button>
            {editId && (
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card mt-16">
        <h2>Тарифы</h2>
        {!items ? (
          <div className="center">
            <span className="spinner" />
          </div>
        ) : items.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>Тарифов нет. Без активного тарифа корзина не сможет посчитать доставку.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Вес, кг</th>
                  <th>Стоимость</th>
                  <th>Срок</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} style={{ opacity: t.isActive ? 1 : 0.6 }}>
                    <td>
                      <strong>{t.name}</strong>
                    </td>
                    <td>
                      {formatNumber(t.minWeightKg)} – {t.maxWeightKg === null ? '∞' : formatNumber(t.maxWeightKg)}
                    </td>
                    <td>
                      {formatRub(t.baseCostRub)} + {formatRub(t.perKgCostRub)}/кг
                    </td>
                    <td>
                      {t.minDays}–{t.maxDays} дн.
                    </td>
                    <td>{t.isActive ? <span className="badge badge-green">Активен</span> : <span className="badge">Отключён</span>}</td>
                    <td className="actions-cell">
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => startEdit(t)}>
                        Изменить
                      </button>{' '}
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => toggle(t)}>
                        {t.isActive ? 'Отключить' : 'Включить'}
                      </button>
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