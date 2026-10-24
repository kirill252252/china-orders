// Админка: вкладки хранятся в адресной строке (?tab=...).
import { useSearchParams } from 'react-router-dom';
import AdminRates from '../components/admin/AdminRates.jsx';
import AdminStats from '../components/admin/AdminStats.jsx';
import AdminTariffs from '../components/admin/AdminTariffs.jsx';
import AdminUsers from '../components/admin/AdminUsers.jsx';

const TABS = [
  { key: 'stats', label: 'Статистика', Component: AdminStats },
  { key: 'rates', label: 'Курс и комиссия', Component: AdminRates },
  { key: 'tariffs', label: 'Тарифы', Component: AdminTariffs },
  { key: 'users', label: 'Пользователи', Component: AdminUsers },
];

export default function AdminPage() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.key === params.get('tab')) || TABS[0];
  const { Component } = active;

  return (
    <>
      <h1 className="page-title">Администрирование</h1>
      <div className="tabs-scroll">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`tab${t.key === active.key ? ' active' : ''}`} onClick={() => setParams({ tab: t.key })}>
            {t.label}
          </button>
        ))}
      </div>
      <Component key={active.key} />
    </>
  );
}