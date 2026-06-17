import { providerApplicationApi } from '../api/providerApplication.api';
import type { ProviderApplicationPayload } from '../types/providerApplication.types';

export const providerApplicationService = {
  loadCategories: providerApplicationApi.categories,
  submit: (payload: ProviderApplicationPayload) => {
    const clean = {
      ...payload,
      serviceIds: [...new Set(payload.serviceIds)],
      description: payload.description.trim(),
      workingAreas: [...new Set(payload.workingAreas.map((area) => area.trim()).filter(Boolean))],
    };
    if (!clean.serviceIds.length || !clean.workingAreas.length || !clean.description) {
      throw new Error('Vui long hoan thanh tat ca thong tin bat buoc.');
    }
    return providerApplicationApi.create(clean);
  },
};
