import {
  loginApi,
  logoutApi,
  googleLoginApi,
  facebookLoginApi,
  registerApi,
  verifyRegisterOtpApi,
  resendRegisterOtpApi,
  forgotPasswordApi,
  resetPasswordApi,
  getMeApi,
} from '../api/auth.api';
import type {
  LoginRequest,
  RegisterRequest,
  VerifyRegisterOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth.types';
import { useAuthStore } from '../store/auth.store';
import axios from 'axios';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

export const authService = {
  restoreSession: async () => {
    const store = useAuthStore.getState();
    if (!store.token) {
      store.finishInitialization();
      return null;
    }

    try {
      const user = await getMeApi();
      useAuthStore.getState().setUser(user);
      return user;
    } catch {
      useAuthStore.getState().logout();
      return null;
    }
  },

  login: async (credentials: LoginRequest, remember = true) => {
    try {
      const response = await loginApi(credentials);
      const { user, token } = response;
      useAuthStore.getState().setAuth(user, token, remember);
      return response;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to login');
      throw new Error(message, { cause: error });
    }
  },

  register: async (payload: RegisterRequest) => {
    try {
      return await registerApi(payload);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to register');
      throw new Error(message, { cause: error });
    }
  },

  verifyRegisterOtp: async (payload: VerifyRegisterOtpRequest) => {
    try {
      return await verifyRegisterOtpApi(payload);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to verify OTP');
      throw new Error(message, { cause: error });
    }
  },

  resendRegisterOtp: async (email: string) => {
    try {
      return await resendRegisterOtpApi(email);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to resend OTP');
      throw new Error(message, { cause: error });
    }
  },

  forgotPassword: async (payload: ForgotPasswordRequest) => {
    try {
      return await forgotPasswordApi(payload);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to send reset OTP');
      throw new Error(message, { cause: error });
    }
  },

  resetPassword: async (payload: ResetPasswordRequest) => {
    try {
      return await resetPasswordApi(payload);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to reset password');
      throw new Error(message, { cause: error });
    }
  },

  googleLogin: async (
    googleToken: string,
    remember = true,
    tokenType: 'credential' | 'accessToken' = 'credential',
  ) => {
    try {
      const response = await googleLoginApi(
        tokenType === 'accessToken'
          ? { accessToken: googleToken }
          : { credential: googleToken },
      );
      const { user, token } = response;
      useAuthStore.getState().setAuth(user, token, remember);
      return response;
    } catch (error) {
      const message = getErrorMessage(error, 'Google login failed');
      throw new Error(message, { cause: error });
    }
  },

  facebookLogin: async (accessToken: string, remember = true) => {
    try {
      const response = await facebookLoginApi(accessToken);
      const { user, token } = response;
      useAuthStore.getState().setAuth(user, token, remember);
      return response;
    } catch (error) {
      const message = getErrorMessage(error, 'Facebook login failed');
      throw new Error(message, { cause: error });
    }
  },

  logout: async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.warn('Logout API failed, continuing with local cleanup:', error);
    } finally {
      useAuthStore.getState().logout();
    }
  }
};
