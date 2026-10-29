import { useToastFeedback } from "@/components/common/Toast";
import { useState, useEffect, useCallback } from 'react';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBookingStore } from '../hooks/useBookingStore';
import { bookingApi } from '@/features/booking/api/booking.api';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import type { Address, Service, ServiceOption } from '../../../types/booking';
import { getConfirmPaymentErrorMessage } from './confirmPaymentSubmitTypes';
import { isRequiredOptionSelectionMissing } from '../utils/serviceOptionSelection';
import { useToast } from '@/components/common/Toast';
import { useConfirmPaymentVoucher } from './useConfirmPaymentVoucher';
import { useBookingPreview } from '../hooks/useBookingPreview';
import { runConfirmPaymentSubmit } from './confirmPaymentSubmit';
import { useBookingPolicies } from '../hooks/useBookingPolicies';
import { getBookingFingerprint } from '../utils/bookingFingerprint';
import { PENDING_ORDER_ID_KEY, PENDING_ORDER_FINGERPRINT_KEY, PENDING_ORDER_VOUCHER_KEY,
  clearPendingBooking, recoverPendingBooking } from './pendingBookingRecovery';

export const getOptionPrice = (option: ServiceOption) =>
  option.price ?? option.fixedPrice ?? 0;

/** Quản lý thanh toán và khôi phục bước xác nhận khi khách quay lại từ PayOS. */
export const useConfirmPaymentFlow = () => {
  const location = useLocation();
  const [immediateBookingAt] = useState(() => {
    const timestamp = (location.state as { immediateBookingAt?: string } | null)?.immediateBookingAt;
    return timestamp && Number.isFinite(new Date(timestamp).getTime()) ? timestamp : new Date().toISOString();
  });
  const { addToast } = useToast();
  const showSystemAlert = useCallback((message: string) => { addToast(message, "error"); }, [addToast]);
  const {
    categoryId, serviceId, selectedOptionIds, selectedOptionQuantities, addressId,
    orderType, preferredProviderId, preferredProviderName, scheduledAt,
    recurrenceUnit, recurrenceCount, problemDescription, customerAttachments,
    paymentMethod, setPaymentMethod, reset, uniformQuantity,
  } = useBookingStore();

  const bookingFingerprint = getBookingFingerprint({
    serviceId,
    selectedOptionIds,
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
  const bookingPolicies = useBookingPolicies(bookingFingerprint);
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
  const [recoverPending, setRecoverPending] = useState(() => Boolean(currentPendingOrderId));
  const [restoredVoucherCode, setRestoredVoucherCode] = useState(() => sessionStorage.getItem(PENDING_ORDER_VOUCHER_KEY) || '');
  const [pendingError, setPendingError] = useState('');
  const [pendingRetry, setPendingRetry] = useState(0);
  const needsRecovery = Boolean(currentPendingOrderId && recoverPending);
  const pendingOrderLoading = needsRecovery && !pendingError;

  useEffect(() => {
    if (!needsRecovery) return;
    let active = true;
    const restore = async () => {
      setPendingError('');
      try {
        const result = await recoverPendingBooking(currentPendingOrderId);
        if (!active) return;
        if (result.voucherCode !== undefined) setRestoredVoucherCode(result.voucherCode);
        clearPendingBooking();
        setPendingOrderId('');
        setRecoverPending(false);
        if (result.paidOrder) {
          reset();
          navigate('/customer/bookings/success', { state: { order: result.paidOrder } });
        }
      } catch (error) {
        if (active) setPendingError(getConfirmPaymentErrorMessage(error));
      }
    };
    const timer = window.setTimeout(() => { void restore(); }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [currentPendingOrderId, needsRecovery, pendingRetry, navigate, reset]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && sessionStorage.getItem(PENDING_ORDER_ID_KEY)) {
        setRecoverPending(true);
        setPendingRetry((value) => value + 1);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

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

  const voucher = useConfirmPaymentVoucher(orderAmount, service?.serviceType === 'variable_price', !needsRecovery, restoredVoucherCode);
  const { voucherCode, appliedVoucher, setVoucherError } = voucher;
  const previewVoucherCode = appliedVoucher ? voucherCode : undefined;
  const { preview, error: previewError, retry: retryPreview } = useBookingPreview(previewVoucherCode, !needsRecovery);

  const handleConfirm = () => {
    const booking = useBookingStore.getState();
    if (booking.rebookSource && booking.requestedProviderId && booking.preferredProviderId !== booking.requestedProviderId) {
      setPaymentError('Vui lòng quay lại bước chọn lịch để kiểm tra thợ cũ hoặc chọn thợ khác.');
      return;
    }
    if (needsRecovery) { setPaymentError(pendingError || 'Vui lòng chờ kiểm tra thanh toán QR trước khi tiếp tục.'); return; }
    if (!preview) { setPaymentError(previewError ?? 'Vui lòng chờ cập nhật giá.'); retryPreview(); return; }
    return runConfirmPaymentSubmit({
      policyAccepted: bookingPolicies.accepted,
      expectedBookingAmount: preview.bookingAmount,
      expectedFinalAmount: preview.discountedAmount,
      expectedVoucherCode: appliedVoucher?.code ?? null,
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
      appliedVoucher,
      voucherCode,
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
    }).then((result) => {
      if (result !== 'redirected' && sessionStorage.getItem(PENDING_ORDER_ID_KEY)) setRecoverPending(true);
    }).finally(retryPreview);
  };

  return {
    service, address, selectedOptions,
    bookingPolicies,
    policyDepositAmount: service?.serviceType === 'variable_price' ? preview?.depositAmount : undefined,
    policyPayableDeposit: service?.serviceType === 'variable_price' ? preview?.discountedAmount : undefined,
    effectivePaymentMethod, isAppointment,
    isSubmitting: isSubmitting || pendingOrderLoading, paymentError,
    pendingError, retryPendingOrder: () => setPendingRetry((value) => value + 1),
    handleConfirm, setPaymentMethod,
    orderType, scheduledAt, immediateBookingAt, preferredProviderId, preferredProviderName,
    selectedOptionQuantities, uniformQuantity,
    ...voucher,
    previewVoucherCode,
    voucherDiscountAmount: preview?.voucherDiscountAmount ?? 0,
    previewError,
    promotionName: preview?.promotionSnapshot?.name,
  };
};
