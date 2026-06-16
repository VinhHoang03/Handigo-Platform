import api from '@/api/client';
import type { Category, ProviderApplication, ProviderApplicationPayload } from '../types/providerApplication.types';

const data = <T>(response: { data: { data: T } }) => response.data.data;
export const providerApplicationApi = {
  categories: async () => data<Category[]>(await api.get('/categories')),
  create: async (payload: ProviderApplicationPayload) => data<ProviderApplication>(await api.post('/provider-applications', payload)),
  mine: async () => data<ProviderApplication | null>(await api.get('/provider-applications/me')),
};
