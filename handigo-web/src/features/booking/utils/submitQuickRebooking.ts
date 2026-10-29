import type { NavigateFunction } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { resetBookingSession, useBookingStore } from '../hooks/useBookingStore';
import { invalidateBookingPreview } from '../hooks/useBookingPreview';
import { runConfirmPaymentSubmit } from '../components/confirmPaymentSubmit';
import { BOOKING_CREATE_ATTEMPT_KEY, PENDING_ORDER_ID_KEY } from './bookingSessionStorage';
import { getBookingFingerprint } from './bookingFingerprint';
import type { BookingPreview } from '../api/booking.api';
import type { PreparedRebooking, RebookingDraft } from './rebooking';
import type { NearbyProvider } from '@/features/customer-service/api/customerService.api';
import { isRequiredOptionSelectionMissing } from './serviceOptionSelection';
import { getEarliestScheduledAt, isWithinImmediateBookingHours } from '../components/step2Helpers';
import { quickRebookingReturnPath, rememberQuickRebookingReturn } from './quickRebookingReturn';

export const assertNoPendingRebooking = () => {
  if (sessionStorage.getItem(PENDING_ORDER_ID_KEY) || sessionStorage.getItem(BOOKING_CREATE_ATTEMPT_KEY)) {
    throw new Error('Bạn có lần đặt chưa xác định kết quả. Vui lòng kiểm tra tại bước thanh toán trước khi đặt thêm.');
  }
};

/** Dùng cùng luồng chống tạo trùng, thanh toán và khôi phục với form đầy đủ. */
export async function submitQuickRebooking(input: {
  prepared: PreparedRebooking; draft: RebookingDraft; preview: BookingPreview;
  providers: NearbyProvider[]; policyAccepted: boolean;
  navigate: NavigateFunction; setError: (message: string) => void;
}) {
  const { prepared, draft, preview, providers, policyAccepted, navigate, setError } = input;
  assertNoPendingRebooking();
  if (prepared.session !== useAuthStore.getState().sessionRevision) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng mở lại yêu cầu đặt lại.');
  if (!policyAccepted) throw new Error('Vui lòng đồng ý chính sách trước khi xác nhận.');
  if (!draft.addressId || !prepared.addresses.some(address => address._id === draft.addressId)) throw new Error('Vui lòng chọn địa chỉ thực hiện.');
  if (!providers.length || (draft.preferredProviderId && !providers.some(provider => provider.id === draft.preferredProviderId))) {
    throw new Error('Thợ chưa khả dụng với lựa chọn này. Vui lòng chọn lại thợ hoặc thời gian.');
  }
  const missingOptions = isRequiredOptionSelectionMissing(prepared.service, draft.selectedOptionIds, prepared.options);
  if (missingOptions) throw new Error('Vui lòng chọn đủ tùy chọn bắt buộc.');
  if (prepared.service.serviceType === 'variable_price' && draft.paymentMethod === 'cash') throw new Error('Khoản cọc cần thanh toán bằng ví hoặc ngân hàng.');
  if (draft.orderType === 'scheduled' && (!draft.scheduledAt || !Number.isFinite(new Date(draft.scheduledAt).getTime())
    || new Date(draft.scheduledAt).getTime() < getEarliestScheduledAt().getTime())) throw new Error('Vui lòng chọn giờ hẹn hợp lệ.');
  if (draft.orderType === 'normal' && !isWithinImmediateBookingHours()) throw new Error('Đặt ngay chưa khả dụng. Vui lòng chọn giờ hẹn.');
  resetBookingSession();
  invalidateBookingPreview();
  useBookingStore.setState({ ...draft, customerAttachments: [], requestedProviderId: undefined, requestedProviderName: undefined });
  const booking = useBookingStore.getState();
  return runConfirmPaymentSubmit({
    policyAccepted, expectedBookingAmount: preview.bookingAmount, expectedFinalAmount: preview.discountedAmount,
    expectedVoucherCode: null, hasServiceOptions: prepared.options.length > 0,
    serviceId: draft.serviceId, addressId: draft.addressId, orderType: draft.orderType, scheduledAt: draft.scheduledAt,
    service: prepared.service, selectedOptionIds: draft.selectedOptionIds, selectedOptionQuantities: draft.selectedOptionQuantities,
    uniformQuantity: draft.uniformQuantity, preferredProviderId: draft.preferredProviderId,
    recurrenceUnit: booking.recurrenceUnit, recurrenceCount: booking.recurrenceCount,
    problemDescription: draft.problemDescription, customerAttachments: [], effectivePaymentMethod: draft.paymentMethod,
    appliedVoucher: null, voucherCode: '', pendingOrderId: '', bookingFingerprint: getBookingFingerprint(booking),
    isAppointment: draft.orderType === 'scheduled', isOptionSelectionMissing: missingOptions,
    showSystemAlert: setError, setPaymentError: setError, setVoucherError: setError,
    setIsSubmitting: () => {}, setPendingOrderId: () => {}, reset: booking.reset, navigate,
    paymentCancelPath: quickRebookingReturnPath(prepared.order._id),
    beforeExternalRedirect: () => rememberQuickRebookingReturn(prepared.order._id),
  });
}
