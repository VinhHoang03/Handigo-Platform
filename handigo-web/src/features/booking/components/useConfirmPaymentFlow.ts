import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookingStore } from '../hooks/useBookingStore';
import { bookingApi } from '@/features/booking/api/booking.api';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import type { Address, Service, ServiceOption } from '../../../types/booking';
import { isRequiredOptionSelectionMissing } from '../utils/serviceOptionSelection';
import { useSystemAlert } from '@/components/common/SystemAlert';
import { useConfirmPaymentVoucher } from './useConfirmPaymentVoucher';
import {
  PENDING_ORDER_ID_KEY,
  PENDING_ORDER_FINGERPRINT_KEY,
  runConfirmPaymentSubmit,
} from './confirmPaymentSubmit';

export const getOptionPrice = (option: ServiceOption) =>
  option.price ?? option.fixedPrice ?? 0;

/** State + logic thanh toán PayOS/ví/tiền mặt cho ConfirmPaymentPage — không đổi hành vi, chỉ tách khỏi trang. */
export const useConfirmPaymentFlow = () => {
  const { showSystemAlert } = useSystemAlert();
  const {
    categoryId, serviceId, selectedOptionIds, selectedOptionQuantities, addressId,
    orderType, preferredProviderId, preferredProviderName, scheduledAt,
    recurrenceUnit, recurrenceCount, problemDescription, customerAttachments,
    paymentMethod, setPaymentMethod, reset,
  } = useBookingStore();

  const bookingFingerprint = JSON.stringify({
    serviceId,
    selectedOptionIds: [...selectedOptionIds].sort(),
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
  const [paymentError, setPaymentError] = useState('');
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
      });
      serviceCatalogApi.options(serviceId).then((data) => {
        if (isMounted) setOptions(data);
      });
    }
    if (addressId) {
      bookingApi.getAddresses().then((addresses) => {
        if (!isMounted) return;
        const found = addresses.find((a) => a._id === addressId);
        if (found) setAddress(found);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [serviceId, addressId, categoryId]);

  const selectedOptions = options.filter((opt) =>
    selectedOptionIds.includes(opt._id),
  );
  const orderAmount =
    service?.serviceType === 'variable_price'
      ? service.depositAmount || 0
      : (service?.fixedPrice || 0) +
        selectedOptions.reduce((sum, option) => sum + getOptionPrice(option), 0);
  const effectivePaymentMethod =
    service?.serviceType === 'variable_price' && paymentMethod === 'cash'
      ? 'bank'
      : paymentMethod;
  const isAppointment = orderType === 'scheduled' || orderType === 'recurring';

  const voucher = useConfirmPaymentVoucher(orderAmount);
  const { voucherCode, appliedVoucher, setVoucherError } = voucher;

  const handleConfirm = () =>
    runConfirmPaymentSubmit({
      serviceId,
      addressId,
      orderType,
      scheduledAt,
      service,
      selectedOptionIds,
      selectedOptionQuantities,
      preferredProviderId,
      recurrenceUnit,
      recurrenceCount,
      problemDescription,
      customerAttachments,
      effectivePaymentMethod,
      appliedVoucher,
      voucherCode,
      pendingOrderId,
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
    });

  return {
    service, address, selectedOptions,
    effectivePaymentMethod, isAppointment,
    isSubmitting, paymentError,
    handleConfirm, setPaymentMethod,
    orderType, scheduledAt, preferredProviderId, preferredProviderName,
    selectedOptionQuantities,
    ...voucher,
  };
};
