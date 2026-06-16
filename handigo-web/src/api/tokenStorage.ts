const TOKEN_STORAGE_KEYS = ['token', 'handigo_token'] as const;

export const tokenStorage = {
  get: () => {
    for (const key of TOKEN_STORAGE_KEYS) {
      const token = localStorage.getItem(key);
      if (token) return token;
    }

    return null;
  },
  set: (token: string) => {
    for (const key of TOKEN_STORAGE_KEYS) {
      localStorage.setItem(key, token);
    }
  },
  clear: () => {
    for (const key of TOKEN_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  },
};
