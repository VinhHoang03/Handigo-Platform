import api from '@/api/client';
import type {
  Category,
  OcrDocumentKind,
  ProviderApplication,
  ProviderApplicationAssetUpload,
  ProviderApplicationPayload,
  ProviderApplicationDraftPayload,
  ProviderApplicationListResult,
  ServiceAdditionApplicationPayload,
} from '../types/providerApplication.types';

const data = <T>(response: { data: { data: T } }) => response.data.data;

const normalizeApplication = (
  application: ProviderApplication,
): ProviderApplication => ({
  ...application,
  applicationType: application.applicationType || 'initial',
  serviceIds: application.serviceIds || [],
  workingAreas: application.workingAreas || [],
  certificates: application.certificates || [],
  reviewHistory: application.reviewHistory || [],
});

export const providerApplicationApi = {
  categories: async () => data<Category[]>(await api.get('/categories/active-with-services')),
  create: async (payload: ProviderApplicationPayload) =>
    normalizeApplication(
      data<ProviderApplication>(await api.post('/provider-applications', payload)),
    ),
  createServiceAddition: async (payload: ServiceAdditionApplicationPayload) =>
    normalizeApplication(
      data<ProviderApplication>(await api.post('/provider-applications', payload)),
    ),
  mine: async () => {
    const application = data<ProviderApplication | null>(
      await api.get('/provider-applications/me'),
    );
    return application ? normalizeApplication(application) : null;
  },
  history: async (page = 1, limit = 10) => {
    const result = data<ProviderApplicationListResult>(
      await api.get('/provider-applications/me/history', { params: { page, limit } }),
    );
    return {
      ...result,
      items: (result.items || []).map(normalizeApplication),
    };
  },
  detail: async (id: string) =>
    normalizeApplication(
      data<ProviderApplication>(await api.get(`/provider-applications/${id}`)),
    ),
  resubmit: async (id: string, payload: ProviderApplicationPayload) =>
    normalizeApplication(
      data<ProviderApplication>(
        await api.patch(`/provider-applications/${id}/resubmit`, payload),
      ),
    ),
  resubmitServiceAddition: async (
    id: string,
    payload: ServiceAdditionApplicationPayload,
  ) =>
    normalizeApplication(
      data<ProviderApplication>(
        await api.patch(`/provider-applications/${id}/resubmit`, payload),
      ),
    ),
  saveDraft: async (payload: ProviderApplicationDraftPayload) =>
    normalizeApplication(
      data<ProviderApplication>(
        await api.patch('/provider-applications/me/draft', payload),
      ),
    ),
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
