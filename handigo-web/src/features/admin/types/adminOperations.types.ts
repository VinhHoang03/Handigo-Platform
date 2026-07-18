import type { Pagination } from "./admin.types";
import type { WalletTransaction } from "@/features/wallet/types/wallet.types";

export interface AdminOverview {
  totalRevenue: number;
  platformRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalDeposits: number;
  totalWithdrawals: number;
  providerEarnings: number;
  pendingWithdrawals: number;
  pendingWithdrawalAmount: number;
}

export interface AdminOrderAnalytics {
  ordersByStatus: Array<{ status: string; count: number }>;
  ordersByServiceCategory: Array<{
    categoryId?: string | null;
    categoryName: string;
    count: number;
  }>;
  ordersByMonth: Array<{ month: string; count: number }>;
  completionRate: number;
  cancellationRate: number;
}

export interface AdminProviderAnalytics {
  totalProviders: number;
  activeProviders: number;
  onlineProviders: number;
  averageProviderRating: number;
  topProvidersByRevenue: Array<{
    providerId: string;
    userId: string;
    fullName?: string;
    email?: string;
    revenue: number;
    averageRating: number;
    completedOrders: number;
  }>;
  topProvidersByCompletedOrders: Array<{
    providerId: string;
    userId: string;
    fullName?: string;
    email?: string;
    completedOrders: number;
    averageRating: number;
  }>;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "payos" | "vnpay" | "cash" | "wallet" | "bank";
export type PaymentType = "full" | "remaining" | "inspection_deposit";

export interface AdminPayment {
  _id: string;
  orderId: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  paymentType: PaymentType;
  status: PaymentStatus;
  transactionCode?: string | null;
  gatewayOrderCode?: string | null;
  gatewayPaymentLinkId?: string | null;
  gatewayTransactionId?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  refundedAt?: string | null;
  failureReason?: string | null;
  refundReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentQuery {
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  method?: PaymentMethod;
  paymentType?: PaymentType;
}

export interface AdminWalletRow {
  providerId: string;
  provider: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    status: string;
  } | null;
  balance: number;
  pendingBalance: number;
  currency: string;
  walletId?: string | null;
}

export interface AdminWalletDetail extends AdminWalletRow {
  totalEarnings: number;
  totalWithdrawn: number;
  totalPlatformFeesPaid: number;
  totalDeposited: number;
  totalPaid: number;
}

export interface AdminWalletQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortByBalance?: "asc" | "desc";
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export type AdminWalletTransaction = WalletTransaction;
