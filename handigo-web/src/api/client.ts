import axios, { type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "./tokenStorage";
import { useAuthStore } from "@/features/auth/store/auth.store";

interface RefreshTokenResponse {
  token: string;
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const REFRESH_TOKEN_PATH = "/auth/refresh-token";
const REFRESH_THRESHOLD_MS = 60_000;
let refreshPromise: Promise<string> | null = null;

const getTokenExpiresAt = (token: string) => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(window.atob(paddedPayload)) as { exp?: number };
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

const shouldRefreshToken = (token: string) => {
  const expiresAt = getTokenExpiresAt(token);
  if (!expiresAt) return false;
  return expiresAt - Date.now() <= REFRESH_THRESHOLD_MS;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post<RefreshTokenResponse>(REFRESH_TOKEN_PATH)
      .then((response) => {
        const token = response.data.token;
        useAuthStore.getState().setToken(token);
        return token;
      })
      .catch((error) => {
        useAuthStore.getState().logout();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.request.use(async (config) => {
  let token = tokenStorage.get();
  const isRefreshRequest = config.url === REFRESH_TOKEN_PATH;

  if (token && !isRefreshRequest && shouldRefreshToken(token)) {
    token = await refreshAccessToken();
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url !== REFRESH_TOKEN_PATH
    ) {
      originalRequest._retry = true;

      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api.request(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
