import api from '@/api/client';
import { unwrap } from '@/api/response';
import type { Voucher, VoucherListResult, VoucherPayload, VoucherQuery } from '../types/voucher.types';

export const voucherApi = {
  list: async (query: VoucherQuery) =>
    unwrap<VoucherListResult>(await api.get('/vouchers', { params: query })),

  create: async (payload: VoucherPayload) =>
    unwrap<Voucher>(await api.post('/vouchers', payload)),

  update: async (id: string, payload: Partial<VoucherPayload>) =>
    unwrap<Voucher>(await api.patch(`/vouchers/${id}`, payload)),

  enable: async (id: string) =>
    unwrap<Voucher>(await api.patch(`/vouchers/${id}/enable`)),

  disable: async (id: string) =>
    unwrap<Voucher>(await api.patch(`/vouchers/${id}/disable`)),

  delete: async (id: string) =>
    unwrap<Voucher>(await api.delete(`/vouchers/${id}`)),
};
