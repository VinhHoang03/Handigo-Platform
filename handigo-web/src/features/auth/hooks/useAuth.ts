import { useState } from 'react';
import type { LoginRequest } from '../types/auth.types';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated, logout } = useAuthStore();

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authService.login(credentials);
      return response.user;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout
  };
};
