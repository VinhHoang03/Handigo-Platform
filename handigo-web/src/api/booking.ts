import api from './client';
import type { Category, Service, ServiceOption, Address, Order, Pagination, OrderQuotation, CreatePaymentResult, Payment } from '../types/booking';

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

export interface CreateAddressPayload {
  recipientName: string;
  recipientPhone: string;
  fullAddress: string;
  province: string;
  ward: string;
  isDefault?: boolean;
  note?: string | null;
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
  createAddress: async (payload: CreateAddressPayload) => {
    const response = await api.post<{ success: boolean; data: Address }>('/addresses', payload);
    return response.data.data;
  },
  uploadOrderAttachment: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post<{ success: boolean; data: { url: string } }>(
      '/orders/attachments',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data.url;
  },
  createOrder: async (payload: CreateOrderPayload) => {
    const response = await api.post<{ success: boolean; data: Order }>('/orders', payload);
    return response.data.data;
  },
  createPayment: async (payload: {
    orderId: string;
    method: 'PAYOS' | 'CASH';
    paymentType?: 'INSPECTION_DEPOSIT' | 'FULL' | 'REMAINING';
    returnUrl?: string;
    cancelUrl?: string;
  }) => {
    const response = await api.post<{ success: boolean; data: CreatePaymentResult }>('/payments/create', payload);
    return response.data.data;
  },
  getPaymentById: async (paymentId: string) => {
    const response = await api.get<{ success: boolean; data: Payment }>(`/payments/${paymentId}`);
    return response.data.data;
  },
  getMyOrders: async (page = 1, limit = 10, status?: string, search?: string) => {
    let url = `/orders?page=${page}&limit=${limit}`;
    if (status && status !== 'Tất cả') url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get<{ success: boolean; data: { items: Order[]; pagination: Pagination } }>(url);
    return response.data.data;
  },
  getProviderRecentOrders: async (limit = 5) => {
    const response = await api.get<{ success: boolean; data: { items: Order[] } }>(
      `/orders/provider/recent?limit=${limit}`,
    );
    return response.data.data.items;
  },
  getOrderById: async (orderId: string) => {
    const response = await api.get<{ success: boolean; data: Order }>(`/orders/${orderId}`);
    return response.data.data;
  },
  cancelOrder: async (orderId: string, reason: string) => {
    const response = await api.patch<{ success: boolean; data: Order }>(`/orders/${orderId}/cancel`, { reason });
    return response.data.data;
  },
  getQuotation: async (orderId: string) => {
    const response = await api.get<{ success: boolean; data: OrderQuotation | null }>(`/orders/${orderId}/quotation`);
    return response.data.data;
  },
  confirmQuotation: async (quotationId: string) => {
    const response = await api.post<{ success: boolean; data: OrderQuotation }>(`/orders/quotations/${quotationId}/confirm`);
    return response.data.data;
  },
  rejectQuotation: async (quotationId: string, reason?: string) => {
    const response = await api.post<{ success: boolean; data: OrderQuotation }>(`/orders/quotations/${quotationId}/reject`, { rejectionReason: reason });
    return response.data.data;
  },
};
