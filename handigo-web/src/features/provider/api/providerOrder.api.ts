import api from '@/api/client';
import type { Order } from '@/types/booking';
import type {
  CreateQuotationPayload,
  OrderAssignment,
  ProviderOrdersResult,
  QuotationDetail,
  ScannedQuotationResult,
} from '../types/providerOrder.types';

export const providerOrderApi = {
  arrive: async (orderId: string) => {
    const response = await api.post<{ success: boolean; data: Order }>(`/orders/${orderId}/arrival`);
    return response.data.data;
  },
  checkNoShow: async (orderId: string) => {
    await api.get(`/orders/${orderId}/customer-no-show/eligibility`);
  },
  uploadNoShowEvidence: async (orderId: string, file: File, kind: 'arrival' | 'contact') => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('image', file);
    const response = await api.post<{ success: boolean; data: { id: string; url: string; kind: 'arrival' | 'contact' } }>(`/orders/${orderId}/customer-no-show/evidence`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 110_000,
    });
    return response.data.data;
  },
  uploadNoShowEvidenceBatch: async (orderId: string, arrivalFiles: File[], contactFiles: File[]) => {
    const files = [...arrivalFiles.map(file => ({ file, kind: 'arrival' as const })),
      ...contactFiles.map(file => ({ file, kind: 'contact' as const }))];
    const receipts: Array<{ id: string; url: string; kind: 'arrival' | 'contact' }> = new Array(files.length);
    let nextIndex = 0;
    let failed = false;
    await Promise.all(Array.from({ length: Math.min(2, files.length) }, async () => {
      while (!failed && nextIndex < files.length) {
        const index = nextIndex++;
        try {
          receipts[index] = await providerOrderApi.uploadNoShowEvidence(orderId, files[index].file, files[index].kind);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }));
    return { arrival: receipts.slice(0, arrivalFiles.length), contact: receipts.slice(arrivalFiles.length) };
  },
  reportNoShow: async (orderId: string, payload: { description: string; arrivalEvidenceIds: string[]; contactEvidenceIds: string[]; contactedCustomer: true }) => {
    const response = await api.post<{ success: boolean; data: Order }>(`/orders/${orderId}/customer-no-show`, payload);
    return response.data.data;
  },
  confirmQuotationPayment: async (orderId: string, quotationId: string, expectedRevision: number) => {
    const response = await api.post<{ success: boolean; data: QuotationDetail['quotation'] }>(
      `/orders/${orderId}/quotation/payment/confirm`, { quotationId, expectedRevision },
    );
    return response.data.data;
  },
  updateExpectedEnd: async (orderId: string, expectedEndAt: string) => {
    const response = await api.patch<{ success: boolean; data: { order: Order; affectedOrderCount: number } }>(`/orders/${orderId}/expected-end`, { expectedEndAt });
    return response.data.data;
  },
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
    payload: { completionEvidenceImages: string[]; completionNote?: string; expectedQuotationId?: string; expectedQuotationRevision?: number },
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

  updateQuotation: async (orderId: string, quotationId: string, expectedRevision: number, payload: CreateQuotationPayload) => {
    const response = await api.patch<{ success: boolean; data: QuotationDetail['quotation'] }>(
      `/orders/${orderId}/quotation`, { ...payload, quotationId, expectedRevision },
    );
    return response.data.data;
  },

  scanQuotationItems: async (orderId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('orderId', orderId);
    const response = await api.post<{
      success: boolean;
      data: ScannedQuotationResult;
    }>('/orders/quotation-items/scan-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },


};
