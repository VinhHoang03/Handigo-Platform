import { create } from "zustand";
import { tokenStorage } from "@/api/tokenStorage";
import type { User } from "../types/auth.types";

const USER_STORAGE_KEY = "handigo:user";

const getStoredUser = (): User | null => {
  try {
    const rawUser = sessionStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem(USER_STORAGE_KEY);
    return rawUser ? (JSON.parse(rawUser) as User) : null;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

const setStoredUser = (user: User, remember = localStorage.getItem('handigo:remember-login') !== 'false') => {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  target.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  other.removeItem(USER_STORAGE_KEY);
};

const clearStoredUser = () => {
  localStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (user: User, token: string, remember?: boolean) => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  finishInitialization: () => void;
  logout: () => void;
}

const initialToken = tokenStorage.get();
const initialUser = getStoredUser();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: initialToken,
  isAuthenticated: !!initialToken && !!initialUser,
  isInitializing: true,
  setAuth: (user, token, remember = true) => {
    localStorage.setItem('handigo:remember-login', String(remember));
    tokenStorage.set(token, remember);
    setStoredUser(user, remember);
    set({ user, token, isAuthenticated: true, isInitializing: false });
  },
  setToken: (token) => {
    tokenStorage.set(token);
    set({ token, isAuthenticated: true });
  },
  setUser: (user) => {
    setStoredUser(user);
    set({ user, isAuthenticated: true, isInitializing: false });
  },
  finishInitialization: () => {
    set({ isInitializing: false });
  },
  logout: () => {
    tokenStorage.clear();
    clearStoredUser();
    set({ user: null, token: null, isAuthenticated: false, isInitializing: false });
  },
}));
