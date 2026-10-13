import { useToastFeedback } from "@/components/common/Toast";
import { useState, useEffect, useCallback } from 'react';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { useNavigate } from 'react-router-dom';
import { useBookingStore } from '../hooks/useBookingStore';
import { bookingApi } from '@/features/booking/api/booking.api';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import type { Address, Order, Service, ServiceOption } from '../../../types/booking';
import { getConfirmPaymentErrorMessage } from './confirmPaymentSubmitTypes';
import { isRequiredOptionSelectionMissing } from '../utils/serviceOptionSelection';
import { useToast } from '@/components/common/Toast';
import { useConfirmPaymentVoucher } from './useConfirmPaymentVoucher';
import { useBookingPreview } from '../hooks/useBookingPreview';
import {
  PENDING_ORDER_ID_KEY,
  PENDING_ORDER_FINGERPRINT_KEY,
  runConfirmPaymentSubmit,
} from './confirmPaymentSubmit';

export const getOptionPrice = (option: ServiceOption) =>
  option.price ?? option.fixedPrice ?? 0;

/** State + logic thanh toán PayOS/ví/tiền mặt cho ConfirmPaymentPage — không đổi hành vi, chỉ tách khỏi trang. */
export const useConfirmPaymentFlow = () => {
  const { addToast } = useToast();
  const showSystemAlert = useCallback((message: string) => { addToast(message, "error"); }, [addToast]);
  const {
    categoryId, serviceId, selectedOptionIds, selectedOptionQuantities, addressId,
    orderType, preferredProviderId, preferredProviderName, scheduledAt,
    recurrenceUnit, recurrenceCount, problemDescription, customerAttachments,
    paymentMethod, setPaymentMethod, reset, uniformQuantity,
  } = useBookingStore();

  const bookingFingerprint = JSON.stringify({
    serviceId,
    selectedOptionIds: [...selectedOptionIds].sort(),
    selectedOptionQuantities,
    uniformQuantity,
    addressId,
    orderType,
    preferredProviderId,
    scheduledAt,
    recurrenceUnit,
    recurrenceCount,
  });

  const [service, setService] = useState<Service | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useToastFeedback<string>('', "error");
  const [pendingOrderId, setPendingOrderId] = useState(() =>
    sessionStorage.getItem(PENDING_ORDER_FINGERPRINT_KEY) === bookingFingerprint
      ? sessionStorage.getItem(PENDING_ORDER_ID_KEY) || ''
      : '',
  );
  const navigate = useNavigate();
  const currentPendingOrderId = sessionStorage.getItem(PENDING_ORDER_FINGERPRINT_KEY) === bookingFingerprint ? pendingOrderId : '';
  const voucherLocked = Boolean(currentPendingOrderId);
  const [pendingSnapshot, setPendingSnapshot] = useState<{ id: string; order?: Order; error?: string }>({ id: '' });
  const [pendingRetry, setPendingRetry] = useState(0);
  const pendingOrder = pendingSnapshot.id === currentPendingOrderId ? pendingSnapshot.order : undefined;
  const pendingError = pendingSnapshot.id === currentPendingOrderId ? pendingSnapshot.error : undefined;
  const pendingOrderLoading = voucherLocked && !pendingOrder && !pendingError;
  useEffect(() => {
    if (!currentPendingOrderId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setPendingSnapshot({ id: currentPendingOrderId });
      bookingApi.getOrderById(currentPendingOrderId).then((order) => {
        if (active) setPendingSnapshot({ id: currentPendingOrderId, order });
      }).catch((error: unknown) => {
        if (active) setPendingSnapshot({ id: currentPendingOrderId, error: getConfirmPaymentErrorMessage(error) });
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [currentPendingOrderId, pendingRetry]);

  useEffect(() => {
    let isMounted = true;
    if (serviceId) {
      serviceCatalogApi.serviceById(serviceId).then((data) => {
        if (isMounted) setService(data);
      }).catch(() => {
        if (isMounted) setPaymentError('Không thể tải thông tin dịch vụ.');
      });
      serviceCatalogApi.options(serviceId).then((data) => {
        if (isMounted) setOptions(data);
      }).catch(() => {
        if (isMounted) setPaymentError('Không thể tải tùy chọn dịch vụ.');
      });
    }
    if (addressId) {
      bookingApi.getAddresses().then((addresses) => {
        if (!isMounted) return;
        const found = addresses.find((a) => a._id === addressId);
        if (found) setAddress(found);
      }).catch(() => {
        if (isMounted) setPaymentError('Không thể tải địa chỉ thực hiện dịch vụ.');
      });
    }
    return () => {
      isMounted = false;
    };
  }, [serviceId, addressId, categoryId, setPaymentError]);

  const isCleaning = isAirConditionerCleaning(service) && options.length === 0;
  const selectedOptions = options.filter((opt) =>
    selectedOptionIds.includes(opt._id),
  );
  const orderAmount =
    service?.serviceType === 'variable_price'
      ? service.depositAmount || 0
      : isCleaning
        ? (service?.fixedPrice || 0) * uniformQuantity
        : (service?.fixedPrice || 0) +
          selectedOptions.reduce((sum, option) => sum + getOptionPrice(option) * (selectedOptionQuantities[option._id] ?? 1), 0);
  const effectivePaymentMethod =
    service?.serviceType === 'variable_price' && paymentMethod === 'cash'
      ? 'bank'
      : paymentMethod;
  const isAppointment = orderType === 'scheduled' || orderType === 'recurring';

  const voucher = useConfirmPaymentVoucher(orderAmount, service?.serviceType === 'variable_price');
  const { voucherCode, appliedVoucher, setVoucherError } = voucher;
  const previewVoucherCode = appliedVoucher ? voucherCode : undefined;
  const { preview, error: previewError, retry: retryPreview } = useBookingPreview(previewVoucherCode, !voucherLocked);

  const handleConfirm = () => {
    if (voucherLocked && !pendingOrder) { setPaymentError(pendingError ?? 'Vui lòng chờ tải đơn đang chờ thanh toán.'); return; }
    if (!voucherLocked && !preview) { setPaymentError(previewError ?? 'Vui lòng chờ cập nhật giá.'); retryPreview(); return; }
    return runConfirmPaymentSubmit({
      expectedBookingAmount: pendingOrder?.pricing.bookingAmount ?? preview!.bookingAmount,
      expectedFinalAmount: pendingOrder?.pricing.totalPaidAmount ?? preview!.discountedAmount,
      expectedVoucherCode: voucherLocked ? pendingOrder?.voucherSnapshot?.code ?? null : appliedVoucher?.code ?? null,
      hasServiceOptions: options.length > 0,
      serviceId,
      addressId,
      orderType,
      scheduledAt,
      service,
      selectedOptionIds,
      selectedOptionQuantities,
      uniformQuantity,
      preferredProviderId,
      recurrenceUnit,
      recurrenceCount,
      problemDescription,
      customerAttachments,
      effectivePaymentMethod,
      appliedVoucher: voucherLocked ? null : appliedVoucher,
      voucherCode: voucherLocked ? '' : voucherCode,
      pendingOrderId: currentPendingOrderId,
      bookingFingerprint,
      isAppointment,
      isOptionSelectionMissing: isRequiredOptionSelectionMissing(service, selectedOptionIds, options),
      showSystemAlert,
      setPaymentError,
      setVoucherError,
      setIsSubmitting,
      setPendingOrderId,
      reset,
      navigate,
    }).finally(retryPreview);
  };

  return {
    service, address, selectedOptions,
    effectivePaymentMethod, isAppointment,
    isSubmitting: isSubmitting || pendingOrderLoading, paymentError,
    voucherLocked, pendingOrder, pendingError, retryPendingOrder: () => setPendingRetry((value) => value + 1),
    handleConfirm, setPaymentMethod,
    orderType, scheduledAt, preferredProviderId, preferredProviderName,
    selectedOptionQuantities, uniformQuantity,
    ...voucher,
    previewVoucherCode,
    voucherDiscountAmount: pendingOrder?.pricing.voucherDiscountAmount ?? preview?.voucherDiscountAmount ?? 0,
    previewError,
    promotionName: pendingOrder?.promotionSnapshot?.name ?? preview?.promotionSnapshot?.name,
  };
};
