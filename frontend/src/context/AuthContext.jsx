// Состояние авторизации: текущий пользователь, вход и выход.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshAccessToken, setAccessToken, setAuthLostHandler } from '../api/client.js';

const AuthContext = createContext(null);

function normalizeUser(data) {
  const u = data?.user ?? data;
  return {
    id: String(u.id),
    email: u.email,
    fullName: u.fullName ?? u.full_name ?? u.name ?? '',
    role: typeof u.role === 'string' ? u.role : u.role?.name,
  };
}

async function fetchMe() {
  return normalizeUser(await api.get('/auth/me'));
}

// Восстановление сессии выполняется один раз на загрузку страницы
let bootPromise = null;
function boot() {
  if (!bootPromise) {
    bootPromise = (async () => {
      const token = await refreshAccessToken();
      return token ? await fetchMe() : null;
    })().catch(() => null);
  }
  return bootPromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthLostHandler(() => setUser(null));
    boot()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await fetchMe());
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    const next = data.user ? normalizeUser(data.user) : await fetchMe();
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // выходим локально, даже если сервер недоступен
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен вызываться внутри AuthProvider');
  return ctx;
}