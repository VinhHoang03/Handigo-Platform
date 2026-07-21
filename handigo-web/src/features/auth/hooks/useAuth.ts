import { useState } from 'react';
import type { LoginRequest } from '../types/auth.types';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated, logout } = useAuthStore();

  const login = async (credentials: LoginRequest, remember = true) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authService.login(credentials, remember);
      return response.user;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (
    token: string,
    remember = true,
    tokenType: 'credential' | 'accessToken' = 'credential',
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authService.googleLogin(token, remember, tokenType);
      return response.user;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const facebookLogin = async (accessToken: string, remember = true) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authService.facebookLogin(accessToken, remember);
      return response.user;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Facebook login failed');
      throw err;
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
    googleLogin,
    facebookLogin,
    logout,
  };
};
