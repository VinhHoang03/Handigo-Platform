import { create } from "zustand";
import { tokenStorage } from "@/api/tokenStorage";
import type { User } from "../types/auth.types";

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: initialToken,
  isAuthenticated: !!initialToken,
  isInitializing: true,
  setAuth: (user, token, remember = true) => {
    localStorage.setItem('handigo:remember-login', String(remember));
    tokenStorage.set(token);
    set({ user, token, isAuthenticated: true, isInitializing: false });
  },
  setToken: (token) => {
    tokenStorage.set(token);
    set({ token, isAuthenticated: true });
  },
  setUser: (user) => {
    set({ user, isAuthenticated: true, isInitializing: false });
  },
  finishInitialization: () => {
    set({ isInitializing: false });
  },
  logout: () => {
    tokenStorage.clear();
    set({ user: null, token: null, isAuthenticated: false, isInitializing: false });
  },
}));
