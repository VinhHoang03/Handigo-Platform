import { create } from 'zustand';
import { tokenStorage } from '@/api/tokenStorage';
import type { User } from '../types/auth.types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: tokenStorage.get(),
  isAuthenticated: !!tokenStorage.get(),
  setAuth: (user, token) => {
    tokenStorage.set(token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    tokenStorage.clear();
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
