import api from './client';
import type { Category, Service, ServiceOption, Address, Order, Pagination } from '../types/booking';

export interface CreateOrderPayload {
  serviceId: string;
  selectedOptionIds?: string[];
  addressId: string;
  orderType?: 'normal' | 'urgent' | 'scheduled' | 'recurring';
  scheduledAt?: string;
  problemDescription?: string;
  paymentMethod: 'wallet' | 'bank' | 'cash';
  customerAttachments?: string[];
}

export const bookingApi = {
  getCategories: async () => {
    const response = await api.get<{ success: boolean; data: Category[] }>('/categories/active');
    return response.data.data;
  },
  getServices: async (categoryId: string) => {
    const response = await api.get<{ success: boolean; data: { items: Service[] } }>(`/services?categoryId=${categoryId}&isActive=true`);
    return response.data.data.items;
  },
  getServiceById: async (serviceId: string) => {
    const response = await api.get<{ success: boolean; data: Service }>(`/services/${serviceId}`);
    return response.data.data;
  },
  getOptions: async (serviceId: string) => {
    const response = await api.get<{ success: boolean; data: ServiceOption[] }>(`/services/${serviceId}/options`);
    return response.data.data;
  },
  getAddresses: async () => {
    const response = await api.get<{ success: boolean; data: Address[] }>('/addresses');
    return response.data.data;
  },
  createOrder: async (payload: CreateOrderPayload) => {
    const response = await api.post<{ success: boolean; data: Order }>('/orders', payload);
    return response.data.data;
  },
  getMyOrders: async (page = 1, limit = 10, status?: string, search?: string) => {
    let url = `/orders?page=${page}&limit=${limit}`;
    if (status && status !== 'Tất cả') url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get<{ success: boolean; data: { items: Order[]; pagination: Pagination } }>(url);
    return response.data.data;
  },
  getOrderById: async (orderId: string) => {
    const response = await api.get<{ success: boolean; data: Order }>(`/orders/${orderId}`);
    return response.data.data;
  },
};
