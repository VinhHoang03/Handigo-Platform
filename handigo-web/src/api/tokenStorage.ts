// Keep access token only in-memory to reduce XSS risk. For backwards compatibility we will read
// any persisted token once on startup and then remove it from storage.
const TOKEN_STORAGE_KEYS = ["token", "handigo_token"] as const;
const EXTERNAL_REDIRECT_TOKEN_KEY = "handigo:external-redirect-token";
let inMemoryToken: string | null = null;

const readAndClearLegacy = (): string | null => {
  const redirectToken = sessionStorage.getItem(EXTERNAL_REDIRECT_TOKEN_KEY);
  sessionStorage.removeItem(EXTERNAL_REDIRECT_TOKEN_KEY);
  if (redirectToken) return redirectToken;

  for (const key of TOKEN_STORAGE_KEYS) {
    const t = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (t) {
      // remove legacy persisted token
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      return t;
    }
  }
  return null;
};

export const tokenStorage = {
  get: () => {
    if (inMemoryToken) return inMemoryToken;
    const legacy = readAndClearLegacy();
    if (legacy) {
      inMemoryToken = legacy;
      return inMemoryToken;
    }
    return null;
  },
  // Do NOT persist access tokens to localStorage/sessionStorage anymore.
  set: (
    token: string,
    _remember = localStorage.getItem("handigo:remember-login") !== "false",
  ) => {
    void _remember;
    inMemoryToken = token;
  },
  clear: () => {
    inMemoryToken = null;
    for (const key of TOKEN_STORAGE_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    sessionStorage.removeItem(EXTERNAL_REDIRECT_TOKEN_KEY);
  },
  prepareExternalRedirect: () => {
    if (inMemoryToken) {
      sessionStorage.setItem(EXTERNAL_REDIRECT_TOKEN_KEY, inMemoryToken);
    }
  },
};
