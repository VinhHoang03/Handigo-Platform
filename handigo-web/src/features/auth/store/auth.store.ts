import { create } from 'zustand';
import type { User } from '../types/auth.types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (user: User, token: string, remember?: boolean) => void;
  setUser: (user: User) => void;
  finishInitialization: () => void;
  logout: () => void;
}

const getStoredToken = () =>
  localStorage.getItem('token') || sessionStorage.getItem('token');

const initialToken = getStoredToken();

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: initialToken,
  isAuthenticated: Boolean(initialToken),
  isInitializing: Boolean(initialToken),
  setAuth: (user, token, remember = true) => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', token);
    localStorage.setItem('handigo:remember-login', String(remember));
    set({ user, token, isAuthenticated: true, isInitializing: false });
  },
  setUser: (user) => set({ user, isAuthenticated: true, isInitializing: false }),
  finishInitialization: () => set({ isInitializing: false }),
  logout: () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, isInitializing: false });
  },
}));
