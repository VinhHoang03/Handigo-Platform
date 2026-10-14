import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useState } from 'react';
import { bookingVoucherApi } from '@/features/booking/api/voucher.api';
import type { AvailableVoucher } from '../types/voucher.types';

/** State + validation của mã voucher ở bước xác nhận thanh toán — tách khỏi hook chính cho gọn. */
export const useConfirmPaymentVoucher = (orderAmount: number, inspectionRequired: boolean, enabled = true, initialCode = '') => {
  const [availableVouchers, setAvailableVouchers] = useState<AvailableVoucher[]>([]);
  const [voucherCode, setVoucherCode] = useState(initialCode);
  const [appliedVoucher, setAppliedVoucher] = useState<AvailableVoucher | null>(null);
  const [voucherError, setVoucherError] = useToastFeedback<string>('', "error");

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;
    const resetTimer = window.setTimeout(() => {
      setAppliedVoucher(null);
      setVoucherCode(initialCode);
      setVoucherError('');
      bookingVoucherApi
        .available()
        .then((vouchers) => {
          if (!isMounted) return;
          const available = vouchers.filter((voucher) => !voucher.applicableOrderType ||
            (voucher.applicableOrderType === 'variable_price') === inspectionRequired);
          setAvailableVouchers(available);
          const restored = available.find((voucher) => voucher.code.toUpperCase() === initialCode.toUpperCase());
          if (restored && orderAmount >= (restored.minOrderAmount ?? 0)) {
            setVoucherCode(restored.code);
            setAppliedVoucher(restored);
          }
        })
        .catch(() => {
          if (isMounted) setAvailableVouchers([]);
        });
    }, 0);
    return () => {
      isMounted = false;
      window.clearTimeout(resetTimer);
    };
  }, [inspectionRequired, enabled, initialCode, orderAmount, setVoucherError]);

  const voucherDiscountAmount = appliedVoucher
    ? Math.min(
        appliedVoucher.discountType === 'PERCENT'
          ? Math.floor((orderAmount * appliedVoucher.discountValue) / 100)
          : appliedVoucher.discountValue,
        appliedVoucher.maxDiscountAmount ?? Number.POSITIVE_INFINITY,
        orderAmount,
      )
    : 0;

  const applyVoucherCode = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setAppliedVoucher(null);
      setVoucherError('');
      return;
    }

    const voucher = availableVouchers.find(
      (item) => item.code.toUpperCase() === normalizedCode,
    );
    if (!voucher) {
      setAppliedVoucher(null);
      setVoucherError('Voucher không tồn tại hoặc không còn khả dụng.');
      return;
    }
    if (orderAmount < (voucher.minOrderAmount ?? 0)) {
      setAppliedVoucher(null);
      setVoucherError('Giá trị đơn hàng chưa đạt mức tối thiểu để áp dụng voucher.');
      return;
    }

    setVoucherCode(voucher.code);
    setAppliedVoucher(voucher);
    setVoucherError('');
  };

  return {
    availableVouchers, voucherCode, setVoucherCode,
    appliedVoucher, setAppliedVoucher, voucherError, setVoucherError,
    voucherDiscountAmount, applyVoucherCode,
  };
};
