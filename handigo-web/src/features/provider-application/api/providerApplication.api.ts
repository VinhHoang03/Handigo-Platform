import api from '@/api/client';
import type { Category, ProviderApplication, ProviderApplicationPayload } from '../types/providerApplication.types';

const data = <T>(response: { data: { data: T } }) => response.data.data;
export const providerApplicationApi = {
  categories: async () => data<Category[]>(await api.get('/categories/active-with-services')),
  create: async (payload: ProviderApplicationPayload) => data<ProviderApplication>(await api.post('/provider-applications', payload)),
  mine: async () => data<ProviderApplication | null>(await api.get('/provider-applications/me')),
  saveDraft: async (payload: ProviderApplicationPayload) =>
    data<ProviderApplication>(await api.patch('/provider-applications/me/draft', payload)),
  uploadImage: async (file: File, purpose: 'identity' | 'certificate') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('purpose', purpose);

    return data<{ url: string }>(
      await api.post('/provider-application-assets/images', formData),
    );
  },
};
