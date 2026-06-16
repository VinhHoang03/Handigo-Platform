import api from '@/api/client';
import type {
  Category,
  CategoryDetail,
  CategoryPayload,
  CategoryQuery,
  ListResult,
  Service,
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

  listServices: async (query: ServiceQuery) =>
    unwrap<ListResult<Service>>(await api.get('/services', { params: query })),

  createService: async (payload: ServicePayload) =>
    unwrap<Service>(await api.post('/services', payload)),

  updateService: async (id: string, payload: Partial<ServicePayload>) =>
    unwrap<Service>(await api.put(`/services/${id}`, payload)),

  deleteService: async (id: string) =>
    unwrap<null>(await api.delete(`/services/${id}`)),

  uploadImage: async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return unwrap<UploadedImage>(await api.post('/admin/assets/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
};
