const TOKEN_STORAGE_KEYS = ['token', 'handigo_token'] as const;

const getFrom = (storage: Storage) => {
  for (const key of TOKEN_STORAGE_KEYS) {
    const token = storage.getItem(key);
    if (token) return token;
  }
  return null;
};

export const tokenStorage = {
  get: () => getFrom(sessionStorage) || getFrom(localStorage),
  set: (token: string, remember = localStorage.getItem('handigo:remember-login') !== 'false') => {
    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    for (const key of TOKEN_STORAGE_KEYS) {
      target.setItem(key, token);
      other.removeItem(key);
    }
  },
  clear: () => {
    for (const key of TOKEN_STORAGE_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  },
};
