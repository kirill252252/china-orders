// HTTP-клиент: токен доступа хранится в памяти, refresh-cookie (httpOnly) обновляет его.
// Ответ сервера: { success, data } или { success: false, error: { code, message, details } }.
const BASE = '/api/v1';

let accessToken = null;
let refreshPromise = null;
let onAuthLost = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

export function setAuthLostHandler(handler) {
  onAuthLost = handler;
}

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Понятный текст ошибки для пользователя
export function errorMessage(err) {
  if (err instanceof ApiError) {
    if (Array.isArray(err.details) && err.details.length > 0) {
      return err.details.map((d) => d.message).join('. ');
    }
    return err.message;
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

async function parse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// Один общий refresh на все параллельные запросы
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
        const body = await parse(res);
        if (!res.ok || !body?.data?.accessToken) {
          accessToken = null;
          return null;
        }
        accessToken = body.data.accessToken;
        return accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function buildUrl(path, query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

export async function request(path, { method = 'GET', body, query, auth = true } = {}) {
  const url = buildUrl(path, query);
  const send = () =>
    fetch(url, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res;
  try {
    res = await send();
    if (res.status === 401 && auth && !path.startsWith('/auth/')) {
      const token = await refreshAccessToken();
      if (token) {
        res = await send();
      } else {
        onAuthLost();
      }
    }
  } catch {
    throw new ApiError('Нет соединения с сервером', 0, 'NETWORK_ERROR');
  }

  const payload = await parse(res);
  if (!res.ok) {
    const e = payload?.error;
    throw new ApiError(e?.message || 'Ошибка запроса', res.status, e?.code, e?.details);
  }
  return payload?.data;
}

export const api = {
  get: (path, query) => request(path, { query }),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body: body ?? {} }),
  delete: (path) => request(path, { method: 'DELETE' }),
};