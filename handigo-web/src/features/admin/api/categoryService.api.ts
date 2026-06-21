import api from '@/api/client';
import type {
  Category,
  CategoryDetail,
  CategoryPayload,
  CategoryQuery,
  ListResult,
  Service,
  ServiceOption,
  ServiceOptionPayload,
  ServicePayload,
  ServiceQuery,
} from '../types/categoryService.types';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface UploadedImage {
  url: string;
}

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export const categoryServiceApi = {
  // ── Categories ──────────────────────────────────────────────────────────────
  listCategories: async (query: CategoryQuery) =>
    unwrap<ListResult<Category>>(await api.get('/categories', { params: query })),

  getCategory: async (id: string) =>
    unwrap<CategoryDetail>(await api.get(`/categories/${id}`)),

  createCategory: async (payload: CategoryPayload) =>
    unwrap<Category>(await api.post('/categories', payload)),

  updateCategory: async (id: string, payload: Partial<CategoryPayload>) =>
    unwrap<Category>(await api.put(`/categories/${id}`, payload)),

  deleteCategory: async (id: string) =>
    unwrap<null>(await api.delete(`/categories/${id}`)),

  // ── Services ────────────────────────────────────────────────────────────────
  listServices: async (query: ServiceQuery) =>
    unwrap<ListResult<Service>>(await api.get('/services', { params: query })),

  getService: async (id: string) =>
    unwrap<Service>(await api.get(`/services/${id}`)),

  createService: async (payload: ServicePayload) =>
    unwrap<Service>(await api.post('/services', payload)),

  updateService: async (id: string, payload: Partial<ServicePayload>) =>
    unwrap<Service>(await api.put(`/services/${id}`, payload)),

  deleteService: async (id: string) =>
    unwrap<null>(await api.delete(`/services/${id}`)),

  // ── Service Options ─────────────────────────────────────────────────────────
  listServiceOptions: async (serviceId: string) =>
    unwrap<ServiceOption[]>(await api.get(`/services/${serviceId}/options`)),

  createServiceOption: async (serviceId: string, payload: ServiceOptionPayload) =>
    unwrap<ServiceOption>(await api.post(`/services/${serviceId}/options`, payload)),

  updateServiceOption: async (optionId: string, payload: Partial<ServiceOptionPayload>) =>
    unwrap<ServiceOption>(await api.patch(`/services/options/${optionId}`, payload)),

  deleteServiceOption: async (optionId: string) =>
    unwrap<null>(await api.delete(`/services/options/${optionId}`)),

  // ── Assets ──────────────────────────────────────────────────────────────────
  uploadImage: async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return unwrap<UploadedImage>(await api.post('/admin/assets/images', form));
  },
};
