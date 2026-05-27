import api from '@/api/client';
import type { LoginRequest, AuthResponse } from '../types/auth.types';

export const loginApi = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', data);
  return response.data;
};

export const logoutApi = async (): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>('/auth/logout');
  return response.data;
};

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const changePasswordApi = async (data: ChangePasswordRequest): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>('/auth/change-password', data);
  return response.data;
};
