import type { RewardOffer } from '@/features/rewards/api/rewards.api';

export type AdminRewardOffer = Omit<RewardOffer, 'termsVersion'> & {
  isActive: boolean;
  discountType: 'AMOUNT' | 'PERCENT';
  applicableOrderType: 'fixed_price' | 'variable_price';
};

export type VoucherDiscountType = 'PERCENT' | 'AMOUNT';
export type VoucherStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export interface Voucher {
  id: string;
  ownerId?: string | null;
  reservedOrderId?: string | null;
  applicableOrderType?: 'fixed_price' | 'variable_price' | null;
  code: string;
  name: string;
  description?: string | null;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  reservedCount?: number;
  perUserLimit?: number;
  startAt: string;
  endAt: string;
  status: VoucherStatus;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherQuery {
  source?: 'all' | 'public' | 'reward';
  page?: number;
  limit?: number;
  search?: string;
  status?: VoucherStatus | '';
}

export interface VoucherPayload {
  perUserLimit?: number;
  code: string;
  name?: string;
  description?: string | null;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  usageLimit?: number | null;
  startAt: string;
  endAt: string;
  status?: Exclude<VoucherStatus, 'EXPIRED'>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VoucherListResult {
  items: Voucher[];
  pagination: Pagination;
}
