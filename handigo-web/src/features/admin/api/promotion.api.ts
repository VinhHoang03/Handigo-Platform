import api from '@/api/client';

export interface AutomaticPromotion {
  _id: string; name: string; description?: string | null;
  discountType: 'AMOUNT' | 'PERCENT'; discountValue: number;
  maxDiscountAmount?: number | null; minOrderAmount?: number | null; usageLimit?: number | null;
  usedCount: number; startAt: string; endAt: string; status: 'ACTIVE' | 'INACTIVE';
  serviceIds: string[]; priority: number; allowVoucher: boolean;
}
export type PromotionPayload = Omit<AutomaticPromotion, '_id' | 'usedCount'>;
export const promotionApi = {
  list: async () => (await api.get<{ data: AutomaticPromotion[] }>('/promotions')).data.data,
  active: async () => (await api.get<{ data: AutomaticPromotion[] }>('/promotions/active')).data.data,
  save: async (payload: PromotionPayload, id?: string) => id ? api.patch(`/promotions/${id}`, payload) : api.post('/promotions', payload),
  remove: async (id: string) => api.delete(`/promotions/${id}`),
};
