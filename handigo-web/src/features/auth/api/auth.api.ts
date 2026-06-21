import api from '@/api/client';
import type {
  LoginRequest,
  GoogleLoginRequest,
  AuthResponse,
  RegisterRequest,
  VerifyRegisterOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  User,
} from '../types/auth.types';

interface MessageResponse {
  message: string;
}

export const loginApi = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', data);
  return response.data;
};

export const registerApi = async (data: RegisterRequest): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>('/auth/register', data);
  return response.data;
};

export const verifyRegisterOtpApi = async (
  data: VerifyRegisterOtpRequest,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>('/auth/verify-register-otp', data);
  return response.data;
};

export const resendRegisterOtpApi = async (
  email: string,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>('/auth/resend-register-otp', { email });
  return response.data;
};

export const forgotPasswordApi = async (
  data: ForgotPasswordRequest,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>('/auth/forgot-password', data);
  return response.data;
};

export const resetPasswordApi = async (
  data: ResetPasswordRequest,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>('/auth/reset-password', data);
  return response.data;
};

export const googleLoginApi = async (data: GoogleLoginRequest): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/google-login', data);
  return response.data;
};

export const facebookLoginApi = async (accessToken: string, remember = true): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/facebook-login', { accessToken, remember });
  return response.data;
};

export const logoutApi = async (): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>('/auth/logout');
  return response.data;
};

export const getMeApi = async (): Promise<User> => {
  const response = await api.get<{ user: User }>('/auth/me');
  const user = response.data.user;
  return { ...user, id: user.id || user._id || '' };
};

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const changePasswordApi = async (data: ChangePasswordRequest): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>('/auth/change-password', data);
  return response.data;
};
