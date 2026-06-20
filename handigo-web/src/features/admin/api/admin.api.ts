import api from '@/api/client';
import type { AdminApplication, AdminQuery, AdminUser, ListResult } from '../types/admin.types';
import type { Category } from '@/features/provider-application/types/providerApplication.types';

const data = <T>(response: { data: { data: T } }) => response.data.data;
export const adminApi = {
  users: async (query: AdminQuery) => data<ListResult<AdminUser>>(await api.get('/admin/users', { params: query })),
  user: async (id: string) => data<AdminUser>(await api.get(`/admin/users/${id}`)),
  updateUserStatus: async (id: string, status: 'active' | 'locked') => data<AdminUser>(await api.patch(`/admin/users/${id}/status`, { status })),
  applications: async (query: AdminQuery) => data<ListResult<AdminApplication>>(await api.get('/admin/provider-applications', { params: query })),
  application: async (id: string) => data<AdminApplication>(await api.get(`/admin/provider-applications/${id}`)),
  review: async (
    id: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string,
    rejectionNotes?: string,
  ) => data<AdminApplication>(await api.patch(`/admin/provider-applications/${id}/review`, {
    status,
    rejectionReason,
    rejectionNotes,
  })),
  categories: async () => data<Category[]>(await api.get('/categories/active')),
};
