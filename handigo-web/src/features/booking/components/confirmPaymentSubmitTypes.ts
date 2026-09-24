import type { NavigateFunction } from 'react-router-dom';
import type { CreateOrderPayload } from '@/features/booking/api/booking.api';
import type { Service } from '../../../types/booking';
import type { AvailableVoucher } from '../types/voucher.types';

/** Tham số đầu vào cho `runConfirmPaymentSubmit` — tách riêng để giữ file logic dưới 200 dòng. */
export interface ConfirmPaymentSubmitParams {
  serviceId?: string;
  addressId?: string;
  orderType: CreateOrderPayload['orderType'];
  scheduledAt?: string;
  service: Service | null;
  selectedOptionIds: string[];
  selectedOptionQuantities?: Record<string, number>;
  preferredProviderId?: string;
  recurrenceUnit: CreateOrderPayload['recurrenceUnit'];
  recurrenceCount?: CreateOrderPayload['recurrenceCount'];
  problemDescription?: string;
  customerAttachments: string[];
  effectivePaymentMethod: CreateOrderPayload['paymentMethod'];
  appliedVoucher: AvailableVoucher | null;
  voucherCode: string;
  pendingOrderId: string;
  bookingFingerprint: string;
  isAppointment: boolean;
  isOptionSelectionMissing: boolean;
  showSystemAlert: (message: string, options: { title: string; variant: 'error' }) => void;
  setPaymentError: (message: string) => void;
  setVoucherError: (message: string) => void;
  setIsSubmitting: (value: boolean) => void;
  setPendingOrderId: (value: string) => void;
  reset: () => void;
  navigate: NavigateFunction;
}

/** Trích thông điệp lỗi dễ đọc từ response API (giữ nguyên logic gốc). */
export const getConfirmPaymentErrorMessage = (error: unknown) => {
  const requestError = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Array<{ message?: string }>;
      };
    };
  };
  return (
    requestError.response?.data?.errors?.find((issue) => issue.message)
      ?.message ||
    requestError.response?.data?.message ||
    'Không thể tạo đơn đặt lịch. Vui lòng thử lại hoặc chọn địa chỉ khác.'
  );
};
