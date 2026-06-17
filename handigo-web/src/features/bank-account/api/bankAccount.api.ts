import api from '@/api/client';
import type { BankAccount, BankAccountPayload } from '../types/bankAccount.types';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export const bankAccountApi = {
  list: async () => unwrap<BankAccount[]>(await api.get('/bank-accounts')),

  create: async (payload: BankAccountPayload) =>
    unwrap<BankAccount>(await api.post('/bank-accounts', payload)),

  update: async (id: string, payload: BankAccountPayload) =>
    unwrap<BankAccount>(await api.patch(`/bank-accounts/${id}`, payload)),

  setDefault: async (id: string) =>
    unwrap<BankAccount>(await api.patch(`/bank-accounts/${id}/default`)),

  delete: async (id: string) =>
    unwrap<BankAccount>(await api.delete(`/bank-accounts/${id}`)),
};
