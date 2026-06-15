import { providerApplicationApi } from '../api/providerApplication.api';
import type { ProviderApplicationPayload } from '../types/providerApplication.types';

export const providerApplicationService = {
  loadCategories: providerApplicationApi.categories,
  submit: (payload: ProviderApplicationPayload) => {
    const clean = {
      ...payload,
      description: payload.description.trim(),
      workingAreas: [...new Set(payload.workingAreas.map((area) => area.trim()).filter(Boolean))],
    };
    if (!clean.serviceCategoryIds.length || !clean.workingAreas.length || !clean.description) {
      throw new Error('Vui lòng hoàn thành tất cả thông tin bắt buộc.');
    }
    return providerApplicationApi.create(clean);
  },
};
