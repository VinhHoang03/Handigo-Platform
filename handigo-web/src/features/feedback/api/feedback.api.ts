import api from '@/api/client';
import type { Feedback, FeedbackList, FeedbackPayload, FeedbackQuery, OrderFeedbackContext } from '../types/feedback.types';
import type { Order } from '@/types/booking';
import type { QuotationDetail } from '@/features/provider/types/providerOrder.types';

export interface AdminFeedbackDetail {
  feedback: Feedback;
  order: Order | null;
  quotation: QuotationDetail | null;
}

const data = <T>(response: { data: { data: T } }) => response.data.data;
export const feedbackApi = {
  getByOrder: async (orderId: string) => data<Feedback | null>(await api.get(`/feedback/orders/${orderId}`)),
  getOrderContext: async (orderId: string) => data<OrderFeedbackContext>(await api.get(`/feedback/orders/${orderId}/context`)),
  getProviderFeedbackByOrder: async (orderId: string) => data<Feedback | null>(await api.get(`/feedback/provider/orders/${orderId}`)),
  create: async (payload: FeedbackPayload) => data<Feedback>(await api.post('/feedback', payload)),
  update: async (id: string, payload: Omit<FeedbackPayload, 'orderId'>) => data<Feedback>(await api.put(`/feedback/${id}`, payload)),
  providerList: async (query: FeedbackQuery) => {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== '' && value !== undefined),
    );
    return data<FeedbackList>(await api.get('/feedback/provider/me', { params }));
  },
  adminList: async (query: FeedbackQuery) => data<FeedbackList>(await api.get('/admin/feedbacks', { params: query })),
  adminDetail: async (id: string) => data<AdminFeedbackDetail>(await api.get(`/admin/feedbacks/${id}`)),
  reply: async (id: string, content: string, images?: string[]) => data<Feedback>(await api.put(`/feedback/${id}/reply`, { content, images })),
  setVisibility: async (id: string, isVisible: boolean) => data<Feedback>(await api.patch(`/feedback/${id}/visibility`, { isVisible })),
  uploadImages: async (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append('images', file));
    return data<string[]>(await api.post('/feedback/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
  uploadReplyImages: async (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append('images', file));
    return data<string[]>(await api.post('/feedback/provider/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
};
