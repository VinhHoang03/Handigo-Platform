import { bookingApi, type CreateOrderPayload } from '@/features/booking/api/booking.api';
import { tokenStorage } from '@/api/tokenStorage';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { getEarliestScheduledAt } from './step2Helpers';
import {
  type ConfirmPaymentSubmitParams,
  getConfirmPaymentErrorMessage,
} from './confirmPaymentSubmitTypes';

export const PENDING_ORDER_ID_KEY = 'pendingBookingOrderId';
export const PENDING_ORDER_FINGERPRINT_KEY = 'pendingBookingFingerprint';

/**
 * Toàn bộ luồng tạo đơn + thanh toán (PayOS/ví/tiền mặt) của bước xác nhận.
 * Tách khỏi hook để giữ file dưới 200 dòng — logic, API call, redirect giữ nguyên 1:1.
 */
export const runConfirmPaymentSubmit = async (params: ConfirmPaymentSubmitParams) => {
  const {
    serviceId, addressId, orderType, scheduledAt, service,
    selectedOptionIds, selectedOptionQuantities, uniformQuantity, preferredProviderId,
    recurrenceUnit, recurrenceCount, problemDescription, customerAttachments,
    effectivePaymentMethod, appliedVoucher, voucherCode, pendingOrderId, bookingFingerprint,
    isAppointment, isOptionSelectionMissing,
    showSystemAlert, setPaymentError, setVoucherError, setIsSubmitting, setPendingOrderId,
    reset, navigate,
  } = params;

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
    (!scheduledAt || new Date(scheduledAt).getTime() < getEarliestScheduledAt().getTime())
  ) {
    setPaymentError('Vui lòng chọn thời gian thực hiện trong tương lai.');
    return;
  }
  if (isOptionSelectionMissing) {
    setPaymentError('Vui lòng chọn ít nhất một tùy chọn dịch vụ.');
    return;
  }
  if (isAirConditionerCleaning(service) && !(service?.fixedPrice && service.fixedPrice > 0)) {
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
    const payload: CreateOrderPayload = {
      expectedBookingAmount: params.expectedBookingAmount,
      serviceId,
      selectedOptionIds: isAirConditionerCleaning(service) ? [] : selectedOptionIds,
      uniformQuantity: isAirConditionerCleaning(service) ? uniformQuantity ?? 1 : undefined,
      selectedOptions: (isAirConditionerCleaning(service) ? [] : selectedOptionIds).map((optionId) => ({
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
      orderId = createdOrder._id;
      setPendingOrderId(orderId);
      sessionStorage.setItem(PENDING_ORDER_ID_KEY, orderId);
      sessionStorage.setItem(
        PENDING_ORDER_FINGERPRINT_KEY,
        bookingFingerprint,
      );
    } else {
      const existingOrder = await bookingApi.getOrderById(orderId);
      if (existingOrder.pricing.bookingAmount !== params.expectedBookingAmount) {
        navigate(`/customer/bookings/${orderId}`);
        return;
      }
    }

    if (effectivePaymentMethod === 'bank') {
      const payment = await bookingApi.createPayment({
        orderId,
        method: 'PAYOS',
        paymentType:
          service?.serviceType === 'variable_price'
            ? 'INSPECTION_DEPOSIT'
            : 'FULL',
        returnUrl: `${window.location.origin}/customer/bookings/success?orderId=${orderId}`,
        cancelUrl: `${window.location.origin}/customer/bookings/new/payment`,
      });

      if (!payment.checkoutUrl) {
        throw new Error('PayOS checkoutUrl is missing');
      }

      sessionStorage.setItem('latestBookingOrderId', orderId);
      tokenStorage.prepareExternalRedirect();
      window.location.href = payment.checkoutUrl;
      return;
    }

    await bookingApi.createPayment(
      effectivePaymentMethod === 'wallet'
        ? {
            orderId,
            method: 'WALLET',
            paymentType:
              service?.serviceType === 'variable_price'
                ? 'INSPECTION_DEPOSIT'
                : 'FULL',
          }
        : {
            orderId,
            method: 'CASH',
            paymentType: 'FULL',
          },
    );

    const orderDetail = await bookingApi.getOrderById(orderId);

    sessionStorage.removeItem(PENDING_ORDER_ID_KEY);
    sessionStorage.removeItem(PENDING_ORDER_FINGERPRINT_KEY);
    reset();
    navigate('/customer/bookings/success', { state: { order: orderDetail } });
  } catch (error) {
    const message = getConfirmPaymentErrorMessage(error);
    if (orderId && (!isAppointment || service?.serviceType === 'variable_price')) {
      try {
        await bookingApi.discardUnpaidOrder(orderId);
        setPendingOrderId('');
        sessionStorage.removeItem(PENDING_ORDER_ID_KEY);
        sessionStorage.removeItem(PENDING_ORDER_FINGERPRINT_KEY);
      } catch {
        // Giữ lại mã đơn để lần thử sau tiếp tục trên cùng một đơn hợp lệ.
      }
    }
    console.error('Không thể tạo đơn đặt lịch.', error);
    if (message.toLowerCase().includes('voucher')) {
      setVoucherError(message);
    } else {
      setPaymentError(message);
    }
  } finally {
    setIsSubmitting(false);
  }
};
