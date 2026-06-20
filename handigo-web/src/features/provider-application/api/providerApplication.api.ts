import api from '@/api/client';
import type {
  Category,
  OcrDocumentKind,
  ProviderApplication,
  ProviderApplicationAssetUpload,
  ProviderApplicationPayload,
  ProviderApplicationListResult,
} from '../types/providerApplication.types';

const data = <T>(response: { data: { data: T } }) => response.data.data;
export const providerApplicationApi = {
  categories: async () => data<Category[]>(await api.get('/categories/active-with-services')),
  create: async (payload: ProviderApplicationPayload) => data<ProviderApplication>(await api.post('/provider-applications', payload)),
  mine: async () => data<ProviderApplication | null>(await api.get('/provider-applications/me')),
  history: async (page = 1, limit = 10) =>
    data<ProviderApplicationListResult>(
      await api.get('/provider-applications/me/history', { params: { page, limit } }),
    ),
  detail: async (id: string) =>
    data<ProviderApplication>(await api.get(`/provider-applications/${id}`)),
  resubmit: async (id: string, payload: ProviderApplicationPayload) =>
    data<ProviderApplication>(
      await api.patch(`/provider-applications/${id}/resubmit`, payload),
    ),
  saveDraft: async (payload: ProviderApplicationPayload) =>
    data<ProviderApplication>(await api.patch('/provider-applications/me/draft', payload)),
  uploadImage: async (
    file: File,
    purpose: 'identity' | 'certificate',
    documentKind: OcrDocumentKind,
  ) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('purpose', purpose);
    formData.append('documentKind', documentKind);

    return data<ProviderApplicationAssetUpload>(
      await api.post('/provider-application-assets/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
};
