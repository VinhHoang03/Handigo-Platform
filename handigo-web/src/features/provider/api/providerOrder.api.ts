import api from '@/api/client';
import type { Order } from '@/types/booking';
import type {
  CreateQuotationPayload,
  OrderAssignment,
  ProviderOrdersResult,
  QuotationDetail,
} from '../types/providerOrder.types';

export const providerOrderApi = {
  getPendingAssignments: async () => {
    const response = await api.get<{ success: boolean; data: OrderAssignment[] }>(
      '/orders/assignments/pending',
    );
    return response.data.data;
  },

  getRecentOrders: async (limit = 5) => {
    const response = await api.get<{
      success: boolean;
      data: { items: Order[] };
    }>(`/orders/provider/recent?limit=${limit}`);
    return response.data.data.items;
  },

  getProviderOrders: async (page = 1, limit = 10, status?: string, search?: string) => {
    let url = `/orders/provider?page=${page}&limit=${limit}`;
    if (status && status !== 'all') url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get<{ success: boolean; data: ProviderOrdersResult }>(url);
    return response.data.data;
  },

  acceptAssignment: async (assignmentId: string) => {
    const response = await api.post<{ success: boolean; data: { order: Order } }>(
      `/orders/assignments/${assignmentId}/accept`,
    );
    return response.data.data;
  },

  rejectAssignment: async (assignmentId: string, rejectReason?: string) => {
    const response = await api.post<{ success: boolean; data: { message: string } }>(
      `/orders/assignments/${assignmentId}/reject`,
      { rejectReason },
    );
    return response.data.data;
  },

  startOrder: async (orderId: string) => {
    const response = await api.post<{ success: boolean; data: Order }>(
      `/orders/${orderId}/start`,
    );
    return response.data.data;
  },

  completeOrder: async (
    orderId: string,
    payload: { completionEvidenceImages: string[]; completionNote?: string },
  ) => {
    const response = await api.post<{ success: boolean; data: Order }>(
      `/orders/${orderId}/complete`,
      payload,
    );
    return response.data.data;
  },

  cancelOrder: async (orderId: string, reason: string) => {
    const response = await api.patch<{ success: boolean; data: Order }>(
      `/orders/${orderId}/cancel`,
      { reason },
    );
    return response.data.data;
  },

  getQuotation: async (orderId: string) => {
    const response = await api.get<{ success: boolean; data: QuotationDetail | null }>(
      `/orders/${orderId}/quotation`,
    );
    return response.data.data;
  },

  createQuotation: async (orderId: string, payload: CreateQuotationPayload) => {
    const response = await api.post<{ success: boolean; data: QuotationDetail['quotation'] }>(
      `/orders/${orderId}/quotations`,
      payload,
    );
    return response.data.data;
  },
};
