import { loginApi, logoutApi } from '../api/auth.api';
import type { LoginRequest } from '../types/auth.types';
import { useAuthStore } from '../store/auth.store';
import axios from 'axios';

export const authService = {
  login: async (credentials: LoginRequest) => {
    try {
      const response = await loginApi(credentials);
      
      // Update store after successful login
      const { user, token } = response;
      useAuthStore.getState().setAuth(user, token);
      
      return response;
    } catch (error) {
      // Basic error handling or transformation can go here
      let message = 'Failed to login';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      throw new Error(message, { cause: error });
    }
  },

  logout: async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.warn('Logout API failed, continuing with local cleanup:', error);
    } finally {
      // Always remove local tokens regardless of API success
      useAuthStore.getState().logout();
    }
  }
};
