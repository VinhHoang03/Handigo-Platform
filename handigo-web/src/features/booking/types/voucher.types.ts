export interface AvailableVoucher {
  id: string;
  code: string;
  name?: string;
  description?: string | null;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: number;
  discountAmount?: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  startAt: string;
  endAt: string;
  finalAmount?: number;
  applicableOrderType?: "fixed_price" | "variable_price" | null;
}

export interface AppliedVoucherResult {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucher: AvailableVoucher | { code: string } | null;
}
