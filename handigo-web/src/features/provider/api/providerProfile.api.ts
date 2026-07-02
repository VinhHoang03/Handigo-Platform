import api from '@/api/client';
import type {
  OcrDocumentKind,
  ProviderAssetUpload,
  ProviderProfileResponse,
  SubmitIdentityPayload,
  UpdateProviderProfilePayload,
  UpsertCertificatePayload,
} from '../types/provider.types';

const data = <T>(response: { data: { data: T } }) => response.data.data;

export const providerProfileApi = {
  getProfile: async () =>
    data<ProviderProfileResponse>(await api.get('/providers/me')),

  updateProfile: async (payload: UpdateProviderProfilePayload) =>
    data<ProviderProfileResponse>(await api.patch('/providers/me', payload)),

  submitIdentity: async (payload: SubmitIdentityPayload) =>
    data<ProviderProfileResponse>(
      await api.post('/providers/me/identity', payload),
    ),

  createCertificate: async (payload: UpsertCertificatePayload) =>
    data<ProviderProfileResponse>(
      await api.post('/providers/me/certificates', payload),
    ),

  updateCertificate: async (
    certificateId: string,
    payload: Partial<UpsertCertificatePayload>,
  ) =>
    data<ProviderProfileResponse>(
      await api.patch(`/providers/me/certificates/${certificateId}`, payload),
    ),

  deleteCertificate: async (certificateId: string) =>
    data<ProviderProfileResponse>(
      await api.delete(`/providers/me/certificates/${certificateId}`),
    ),

  uploadImage: async (
    file: File,
    purpose: 'identity' | 'certificate' | 'portfolio' | 'avatar',
    documentKind?: OcrDocumentKind,
  ) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('purpose', purpose);
    if (documentKind) formData.append('documentKind', documentKind);

    return data<ProviderAssetUpload>(
      await api.post('/provider-assets/images', formData),
    );
  },
};
