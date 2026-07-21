import api from "@/api/client";
import { unwrap } from "@/api/response";
import type {
  AdminOrderAnalytics,
  AdminOverview,
  AdminPayment,
  AdminRefund,
  AdminProviderAnalytics,
  AdminWalletDetail,
  AdminWalletQuery,
  AdminWalletRow,
  AdminWalletTransaction,
  Paginated,
  PaymentQuery,
} from "../types/adminOperations.types";
import type { WalletTransactionQuery } from "@/features/wallet/types/wallet.types";

export interface DashboardQuery {
  fromDate?: string;
  toDate?: string;
  topLimit?: number;
}

export const adminOperationsApi = {
  overview: async (query: DashboardQuery) =>
    unwrap<AdminOverview>(await api.get("/dashboard/overview", { params: query })),
  orderAnalytics: async (query: DashboardQuery) =>
    unwrap<AdminOrderAnalytics>(await api.get("/dashboard/orders", { params: query })),
  providerAnalytics: async (query: DashboardQuery) =>
    unwrap<AdminProviderAnalytics>(await api.get("/dashboard/providers", { params: query })),

  payments: async (query: PaymentQuery) =>
    unwrap<Paginated<AdminPayment>>(await api.get("/payments/history", { params: query })),
  payment: async (id: string) =>
    unwrap<AdminPayment>(await api.get(`/payments/${id}`)),
  retryPaymentRefund: async (paymentId: string) =>
    unwrap<AdminRefund>(await api.post(`/payments/${paymentId}/refund/retry`)),

  wallets: async (query: AdminWalletQuery) =>
    unwrap<Paginated<AdminWalletRow>>(await api.get("/wallets/admin", { params: query })),
  wallet: async (providerId: string) =>
    unwrap<AdminWalletDetail>(await api.get(`/wallets/admin/${providerId}`)),
  walletTransactions: async (providerId: string, query: WalletTransactionQuery) =>
    unwrap<Paginated<AdminWalletTransaction>>(
      await api.get(`/wallets/admin/${providerId}/transactions`, { params: query }),
    ),
  adjustWallet: async (
    providerId: string,
    payload: { amount: number; direction: "in" | "out"; reason: string },
  ) =>
    unwrap<AdminWalletTransaction>(
      await api.patch(`/wallets/admin/${providerId}/adjust`, payload),
    ),
};
