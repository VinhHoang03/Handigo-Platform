import api from '@/api/client';
import { unwrap } from '@/api/response';
import type {
  ListResult,
  WalletDepositPayload,
  WalletDepositResult,
  WalletOverview,
  WalletSummary,
  WalletTransaction,
  WalletTransactionQuery,
  WithdrawalPayload,
  WithdrawalQuery,
  WithdrawalRequest,
} from '../types/wallet.types';

export const walletApi = {
  getMine: async () => unwrap<WalletOverview>(await api.get('/wallets/me')),

  getSummary: async () => unwrap<WalletSummary>(await api.get('/wallets/me/summary')),

  listTransactions: async (query: WalletTransactionQuery) =>
    unwrap<ListResult<WalletTransaction>>(await api.get('/wallets/me/transactions', { params: query })),

  createDeposit: async (payload: WalletDepositPayload) =>
    unwrap<WalletDepositResult>(await api.post('/wallets/me/deposit', payload)),

  cancelDeposit: async (orderCode: string) =>
    unwrap<WalletTransaction>(await api.patch(`/wallets/me/deposit/${orderCode}/cancel`)),

  syncDeposit: async (orderCode: string) =>
    unwrap<WalletTransaction>(await api.patch(`/wallets/me/deposit/${orderCode}/sync`)),

  listWithdrawals: async (query: WithdrawalQuery) =>
    unwrap<ListResult<WithdrawalRequest>>(await api.get('/withdrawals/me', { params: query })),

  createWithdrawal: async (payload: WithdrawalPayload) =>
    unwrap<WithdrawalRequest>(await api.post('/withdrawals', payload)),
};
