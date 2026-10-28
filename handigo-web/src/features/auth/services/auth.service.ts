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
  User,
} from '../types/auth.types';
import { useAuthStore } from '../store/auth.store';
import axios from 'axios';

const isNetworkError = (error: unknown) => {
  return axios.isAxiosError(error) && !error.response;
};

let restorePromise: Promise<User | null> | null = null;
let restoreRevision: number | undefined;

const restoreUserSession = async (): Promise<User | null> => {
  const revision = useAuthStore.getState().sessionRevision;
  const isCurrent = () => revision === useAuthStore.getState().sessionRevision;
  try {
    if (!useAuthStore.getState().token) await refreshAccessToken();
    if (!isCurrent()) return null;
    const user = await getMeApi();
    if (!isCurrent()) return null;
    useAuthStore.getState().setUser(user);
    return user;
  } catch (error) {
    if (!isCurrent() || axios.isCancel(error)) return null;
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (isNetworkError(error) || status === 429 || (status !== undefined && status >= 500)) {
      useAuthStore.getState().finishInitialization();
      return useAuthStore.getState().user;
    }

    useAuthStore.getState().logout();
    return null;
  }
};

export const authService = {
  restoreSession: () => {
    // Các lời gọi đồng thời dùng chung một lần khôi phục phiên.
    const revision = useAuthStore.getState().sessionRevision;
    if (!restorePromise || restoreRevision !== revision) {
      restoreRevision = revision;
      const task = restoreUserSession().finally(() => { if (restorePromise === task) restorePromise = null; });
      restorePromise = task;
    }
    return restorePromise;
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
      const response = await verifyRegisterOtpApi(payload);
      if (response.user && response.token) {
        useAuthStore.getState().setAuth(response.user, response.token, true);
      }
      return response;
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
    useAuthStore.getState().logout();
    try {
      await logoutApi();
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.warn("API đăng xuất thất bại, tiếp tục xóa phiên đăng nhập trên thiết bị:", error);
    }
  }
};
