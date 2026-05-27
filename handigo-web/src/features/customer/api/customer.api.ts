import api from '@/api/client';
import type { UserProfile } from '../types/customer.types';

interface BackendUser {
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  role?: string;
  status?: string;
  isEmailVerified?: boolean;
  createdAt?: string;
}

const mapUser = (u: BackendUser): UserProfile => ({
  ...u,
  avatarUrl: u.avatar ?? undefined,
  joinDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }) : undefined,
});

/** GET /users/me → { message, user } */
export const getCustomerProfile = async (): Promise<UserProfile> => {
  const response = await api.get<{ message: string; user: BackendUser }>('/users/me');
  return mapUser(response.data.user);
};

/** PUT /users/profile → { message, data } — only fullName, phone, avatar are editable */
export const updateCustomerProfile = async (data: Partial<UserProfile>): Promise<UserProfile> => {
  const payload: Partial<BackendUser> = {};
  if (data.fullName !== undefined) payload.fullName = data.fullName;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.avatar !== undefined) payload.avatar = data.avatar;
  const response = await api.put<{ message: string; data: BackendUser }>('/users/profile', payload);
  return mapUser(response.data.data);
};
