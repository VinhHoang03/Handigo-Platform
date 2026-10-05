import { useToastFeedback } from "@/components/common/Toast";
import { useState, useEffect, useCallback } from 'react';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import { useNavigate } from 'react-router-dom';
import { useBookingStore } from '../hooks/useBookingStore';
import { bookingApi } from '@/features/booking/api/booking.api';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import type { Address, Service, ServiceOption } from '../../../types/booking';
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
  const { preview, error: previewError, retry: retryPreview } = useBookingPreview();
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

  const selectedOptions = options.filter((opt) => !isAirConditionerCleaning(service) &&
    selectedOptionIds.includes(opt._id),
  );
  const orderAmount =
    service?.serviceType === 'variable_price'
      ? service.depositAmount || 0
      : isAirConditionerCleaning(service)
        ? (service?.fixedPrice || 0) * uniformQuantity
        : (service?.fixedPrice || 0) +
          selectedOptions.reduce((sum, option) => sum + getOptionPrice(option) * (selectedOptionQuantities[option._id] ?? 1), 0);
  const effectivePaymentMethod =
    service?.serviceType === 'variable_price' && paymentMethod === 'cash'
      ? 'bank'
      : paymentMethod;
  const isAppointment = orderType === 'scheduled' || orderType === 'recurring';

  const voucher = useConfirmPaymentVoucher(orderAmount);
  const { voucherCode, appliedVoucher, setVoucherError } = voucher;

  const handleConfirm = () => {
    if (!preview) { setPaymentError(previewError ?? 'Vui lòng chờ cập nhật giá.'); retryPreview(); return; }
    return runConfirmPaymentSubmit({
      expectedBookingAmount: preview.bookingAmount,
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
      pendingOrderId: sessionStorage.getItem(PENDING_ORDER_FINGERPRINT_KEY) === bookingFingerprint ? pendingOrderId : '',
      bookingFingerprint,
      isAppointment,
      isOptionSelectionMissing: isRequiredOptionSelectionMissing(service, selectedOptionIds),
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
    isSubmitting, paymentError,
    handleConfirm, setPaymentMethod,
    orderType, scheduledAt, preferredProviderId, preferredProviderName,
    selectedOptionQuantities, uniformQuantity,
    ...voucher,
  };
};
