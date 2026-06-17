export type WalletTransactionType =
  | 'deposit'
  | 'payment'
  | 'refund'
  | 'provider_earning'
  | 'platform_fee'
  | 'withdraw'
  | 'withdraw_rejected'
  | 'adjustment';

export type WalletTransactionDirection = 'in' | 'out';
export type WalletTransactionStatus = 'pending' | 'success' | 'failed' | 'cancelled';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface WalletOverview {
  balance: number;
  pendingBalance: number;
  totalEarnings: number;
  totalWithdrawn: number;
}

export interface WalletSummary {
  currentBalance: number;
  totalEarnings: number;
  totalWithdrawals: number;
  totalPlatformFeesPaid: number;
}

export interface WalletTransaction {
  _id: string;
  type: WalletTransactionType;
  direction: WalletTransactionDirection;
  amount: number;
  balanceAfter: number;
  status: WalletTransactionStatus;
  transactionCode?: string | null;
  gatewayOrderCode?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccountSnapshot {
  _id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault?: boolean;
}

export interface WithdrawalRequest {
  _id: string;
  amount: number;
  status: WithdrawalStatus;
  bankAccountId?: BankAccountSnapshot | string;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface WalletTransactionQuery {
  page?: number;
  limit?: number;
  type?: WalletTransactionType | '';
  fromDate?: string;
  toDate?: string;
}

export interface WithdrawalQuery {
  page?: number;
  limit?: number;
  status?: WithdrawalStatus | '';
}

export interface WalletDepositPayload {
  amount: number;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface WalletDepositResult {
  transaction: WalletTransaction;
  checkoutUrl: string;
  qrCode?: string;
  amount: number;
}

export interface WithdrawalPayload {
  amount: number;
  bankAccountId?: string;
}
