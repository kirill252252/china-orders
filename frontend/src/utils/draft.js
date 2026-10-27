// Черновик формы добавления товара: хранится в sessionStorage вкладки и привязан к пользователю.
const key = (userId) => `kenny:add-draft:${userId}`;

export function loadDraft(userId) {
  try {
    const raw = sessionStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(userId, data) {
  try {
    sessionStorage.setItem(key(userId), JSON.stringify(data));
  } catch {
    // Хранилище недоступно (например, приватный режим): черновик просто не сохраняется
  }
}

export function clearDraft(userId) {
  try {
    sessionStorage.removeItem(key(userId));
  } catch {
  }
}