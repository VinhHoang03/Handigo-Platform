import { apiRequest, authToken } from './http';
import type { AuthUser, ChangePasswordInput, ProfileUpdateInput } from '../types/auth';

interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

interface UserResponse {
  message?: string;
  user: AuthUser;
}

interface UpdateProfileResponse {
  message: string;
  data: AuthUser;
}

interface MessageResponse {
  message: string;
}

export const authApi = {
  async login(email: string, password: string) {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    authToken.set(response.token);
    return response;
  },

  getProfile() {
    return apiRequest<UserResponse>('/users/me');
  },

  async updateProfile(input: ProfileUpdateInput) {
    const response = await apiRequest<UpdateProfileResponse>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    });

    return response.data;
  },

  changePassword(input: ChangePasswordInput) {
    return apiRequest<MessageResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async logout() {
    try {
      await apiRequest<MessageResponse>('/auth/logout', { method: 'POST' });
    } finally {
      authToken.clear();
    }
  },
};
