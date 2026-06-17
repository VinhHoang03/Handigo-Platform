export type VoucherDiscountType = 'PERCENT' | 'AMOUNT';
export type VoucherStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export interface Voucher {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  startAt: string;
  endAt: string;
  status: VoucherStatus;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: VoucherStatus | '';
}

export interface VoucherPayload {
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
