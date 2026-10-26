import { bookingApi, type CreateOrderPayload } from '@/features/booking/api/booking.api';
import { tokenStorage } from '@/api/tokenStorage';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { getEarliestScheduledAt } from './step2Helpers';
import { getBookingSessionRevision } from '../utils/bookingSessionStorage';
import {
  type ConfirmPaymentSubmitParams,
  getConfirmPaymentErrorMessage,
} from './confirmPaymentSubmitTypes';

import { PENDING_ORDER_ID_KEY, PENDING_ORDER_FINGERPRINT_KEY, PENDING_ORDER_VOUCHER_KEY,
  clearPendingBooking, recoverPendingBooking } from './pendingBookingRecovery';
export { PENDING_ORDER_ID_KEY, PENDING_ORDER_FINGERPRINT_KEY } from './pendingBookingRecovery';

/**
 * Toàn bộ luồng tạo đơn + thanh toán (PayOS/ví/tiền mặt) của bước xác nhận.
 * Tách khỏi hook để giữ file dưới 200 dòng — logic, API call, redirect giữ nguyên 1:1.
 */
export const runConfirmPaymentSubmit = async (params: ConfirmPaymentSubmitParams) => {
  const sessionRevision = getBookingSessionRevision();
  const isCurrentSession = () => sessionRevision === getBookingSessionRevision();
  const {
    serviceId, addressId, orderType, scheduledAt, service,
    selectedOptionIds, selectedOptionQuantities, uniformQuantity, preferredProviderId,
    recurrenceUnit, recurrenceCount, problemDescription, customerAttachments,
    effectivePaymentMethod, appliedVoucher, voucherCode, pendingOrderId, bookingFingerprint,
    isAppointment, isOptionSelectionMissing,
    showSystemAlert, setPaymentError, setVoucherError, setIsSubmitting, setPendingOrderId,
    reset, navigate,
  } = params;

  const isCleaning = isAirConditionerCleaning(service) && !params.hasServiceOptions;

  if (!params.policyAccepted) {
    setPaymentError('Vui lòng đọc và đồng ý với chính sách Handigo trước khi đặt đơn.');
    return;
  }

  if (!serviceId) {
    showSystemAlert('Vui lòng chọn dịch vụ trước khi thanh toán.', {
      title: 'Chưa chọn dịch vụ',
      variant: 'error',
    });
    return;
  }
  if (!addressId) {
    showSystemAlert('Vui lòng chọn địa chỉ thực hiện.', {
      title: 'Chưa chọn địa chỉ',
      variant: 'error',
    });
    return;
  }
  if (
    (orderType === 'scheduled' || orderType === 'recurring') &&
    (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime())
      || new Date(scheduledAt).getTime() < getEarliestScheduledAt().getTime())
  ) {
    setPaymentError('Vui lòng chọn thời gian thực hiện trong tương lai.');
    return;
  }
  if (isOptionSelectionMissing) {
    setPaymentError('Vui lòng chọn ít nhất một tùy chọn dịch vụ.');
    return;
  }
  if (isCleaning && !(service?.fixedPrice && service.fixedPrice > 0)) {
    setPaymentError('Dịch vụ chưa có giá hợp lệ. Vui lòng chọn lại dịch vụ.');
    return;
  }
  if (voucherCode.trim() && !appliedVoucher) {
    setVoucherError('Vui lòng áp dụng voucher hợp lệ trước khi thanh toán.');
    return;
  }

  setIsSubmitting(true);
  setPaymentError('');
  setVoucherError('');
  let orderId = pendingOrderId;
  try {
    if (orderId) {
      const recovery = await recoverPendingBooking(orderId);
      if (!isCurrentSession()) return;
      clearPendingBooking();
      setPendingOrderId('');
      if (recovery.paidOrder) {
        reset();
        navigate('/customer/bookings/success', { state: { order: recovery.paidOrder } });
        return;
      }
      orderId = '';
    }
    const payload: CreateOrderPayload = {
      expectedBookingAmount: params.expectedBookingAmount,
      expectedFinalAmount: params.expectedFinalAmount,
      serviceId,
      selectedOptionIds: isCleaning ? [] : selectedOptionIds,
      uniformQuantity: isCleaning ? uniformQuantity ?? 1 : undefined,
      selectedOptions: (isCleaning ? [] : selectedOptionIds).map((optionId) => ({
        optionId,
        quantity: selectedOptionQuantities?.[optionId] ?? 1,
      })),
      addressId,
      preferredProviderId,
      orderType,
      scheduledAt: scheduledAt
        ? new Date(scheduledAt).toISOString()
        : undefined,
      recurrenceUnit: orderType === 'recurring' ? recurrenceUnit : undefined,
      recurrenceCount: orderType === 'recurring' ? recurrenceCount : undefined,
      problemDescription,
      customerAttachments,
      paymentMethod: effectivePaymentMethod,
      voucherCode: appliedVoucher?.code,
    };

    if (!orderId) {
      const createdOrder = await bookingApi.createOrder(payload);
      if (!isCurrentSession()) return;
      orderId = createdOrder._id;
      setPendingOrderId(orderId);
      sessionStorage.setItem(PENDING_ORDER_ID_KEY, orderId);
      sessionStorage.setItem(PENDING_ORDER_VOUCHER_KEY, appliedVoucher?.code ?? '');
      sessionStorage.setItem(
        PENDING_ORDER_FINGERPRINT_KEY,
        bookingFingerprint,
      );
    }

    if (effectivePaymentMethod === 'bank') {
      const payment = await bookingApi.createPayment({
        orderId,
        expectedAmount: params.expectedFinalAmount,
        method: 'PAYOS',
        paymentType:
          service?.serviceType === 'variable_price'
            ? 'INSPECTION_DEPOSIT'
            : 'FULL',
        returnUrl: `${window.location.origin}/customer/bookings/result?orderId=${orderId}&payos=success`,
        cancelUrl: `${window.location.origin}/customer/bookings/new/payment`,
      });

      if (!isCurrentSession()) return;
      if (payment.payment.status === 'paid') {
        const orderDetail = await bookingApi.getOrderById(orderId);
        if (!isCurrentSession()) return;
        clearPendingBooking();
        reset();
        navigate('/customer/bookings/result', { state: { order: orderDetail } });
        return;
      }
      if (!payment.checkoutUrl) {
        throw new Error('PayOS không trả về liên kết thanh toán.');
      }

      if (payment.checkoutUrl) {
        sessionStorage.setItem('latestBookingOrderId', orderId);
        tokenStorage.prepareExternalRedirect();
        window.location.href = payment.checkoutUrl;
        return 'redirected' as const;
      }
    }

    if (effectivePaymentMethod !== 'bank') await bookingApi.createPayment(
      effectivePaymentMethod === 'wallet'
        ? {
            orderId,
            expectedAmount: params.expectedFinalAmount,
            method: 'WALLET',
            paymentType:
              service?.serviceType === 'variable_price'
                ? 'INSPECTION_DEPOSIT'
                : 'FULL',
          }
        : {
            orderId,
            expectedAmount: params.expectedFinalAmount,
            method: 'CASH',
            paymentType: 'FULL',
          },
    );

    if (!isCurrentSession()) return;
    const orderDetail = await bookingApi.getOrderById(orderId);
    if (!isCurrentSession()) return;

    clearPendingBooking();
    reset();
    navigate('/customer/bookings/result', { state: { order: orderDetail } });
  } catch (error) {
    if (!isCurrentSession()) return;
    const recoveredOrderId = (error as { createdOrderId?: string }).createdOrderId;
    if (recoveredOrderId) {
      clearPendingBooking();
      setPendingOrderId('');
      navigate(`/customer/bookings/${recoveredOrderId}`);
      return;
    }
    const message = getConfirmPaymentErrorMessage(error);
    if (orderId && (!isAppointment || service?.serviceType === 'variable_price')) {
      try {
        await bookingApi.discardUnpaidOrder(orderId);
        if (!isCurrentSession()) return;
        setPendingOrderId('');
        clearPendingBooking();
      } catch {
        // Giữ mã đơn để đối soát thanh toán trước khi thử lại.
      }
    }
    console.error('Không thể tạo đơn đặt lịch.', error);
    if (message.toLowerCase().includes('voucher')) {
      setVoucherError(message);
    } else {
      setPaymentError(message);
    }
  } finally {
    if (isCurrentSession()) setIsSubmitting(false);
  }
};
