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
import { refreshAccessToken } from '@/api/client';
import { getErrorMessage } from '@/utils/apiError';
import type {
  LoginRequest,
  RegisterRequest,
  VerifyRegisterOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth.types';
import { useAuthStore } from '../store/auth.store';
import axios from 'axios';

const isNetworkError = (error: unknown) => {
  return axios.isAxiosError(error) && !error.response;
};

export const authService = {
  restoreSession: async () => {
    const store = useAuthStore.getState();
    if (!store.token) {
      try {
        await refreshAccessToken();
      } catch {
        store.finishInitialization();
        return null;
      }
    }

    try {
      const user = await getMeApi();
      useAuthStore.getState().setUser(user);
      return user;
    } catch (error) {
      if (isNetworkError(error)) {
        useAuthStore.getState().finishInitialization();
        return store.user;
      }

      useAuthStore.getState().logout();
      return null;
    }
  },

  login: async (credentials: LoginRequest, remember = true) => {
    try {
      const response = await loginApi({ ...credentials, remember });
      const { user, token } = response;
      useAuthStore.getState().setAuth(user, token, remember);
      return response;
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể đăng nhập');
      throw new Error(message, { cause: error });
    }
  },

  register: async (payload: RegisterRequest) => {
    try {
      return await registerApi(payload);
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể đăng ký');
      throw new Error(message, { cause: error });
    }
  },

  verifyRegisterOtp: async (payload: VerifyRegisterOtpRequest) => {
    try {
      return await verifyRegisterOtpApi(payload);
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể xác thực mã OTP');
      throw new Error(message, { cause: error });
    }
  },

  resendRegisterOtp: async (email: string) => {
    try {
      return await resendRegisterOtpApi(email);
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể gửi lại mã OTP');
      throw new Error(message, { cause: error });
    }
  },

  forgotPassword: async (payload: ForgotPasswordRequest) => {
    try {
      return await forgotPasswordApi(payload);
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể gửi mã khôi phục');
      throw new Error(message, { cause: error });
    }
  },

  resetPassword: async (payload: ResetPasswordRequest) => {
    try {
      return await resetPasswordApi(payload);
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể đặt lại mật khẩu');
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
          ? { accessToken: googleToken, remember }
          : { credential: googleToken, remember },
      );
      const { user, token } = response;
      useAuthStore.getState().setAuth(user, token, remember);
      return response;
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể đăng nhập bằng Google');
      throw new Error(message, { cause: error });
    }
  },

  facebookLogin: async (accessToken: string, remember = true) => {
    try {
      const response = await facebookLoginApi(accessToken, remember);
      const { user, token } = response;
      useAuthStore.getState().setAuth(user, token, remember);
      return response;
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể đăng nhập bằng Facebook');
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
