import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingApi } from '@/features/booking/api/booking.api';
import { useBookingStore } from '../hooks/useBookingStore';
import type { UserAddress } from '@/features/profile/types/profile.types';
import type { ProviderAvailabilityStatus } from '@/features/customer-service/components/NearbyProviderSelector';
import {
  type Step2FormErrors,
  getEarliestScheduledAt,
  getDefaultScheduledAt,
  getInitialScheduledAt,
  getTodayInputValue,
  getUpcomingDates,
  getUploadErrorMessage,
  isWithinImmediateBookingHours,
  validateImageFile,
} from './step2Helpers';

/** State + handlers cho CreateBookingStep2Page — tách khỏi trang để giữ dưới 200 dòng. */
export const useCreateBookingStep2Form = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    serviceId, addressId, setAddressId,
    preferredProviderId, preferredProviderName, setPreferredProviderId,
    requestedProviderId,
    orderType, setOrderType,
    scheduledAt, setScheduledAt, isScheduleAutomatic, problemDescription, setProblemDescription,
    customerAttachments, setCustomerAttachments,
  } = useBookingStore();
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useToastFeedback<string | null>(null, "error");
  const [formErrors, setFormErrors] = useState<Step2FormErrors>({});
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [providerAvailability, setProviderAvailability] = useState<ProviderAvailabilityStatus>('idle');
  const scheduleInitialized = useRef(false);
  const todayInputValue = getTodayInputValue(new Date(currentTimestamp));
  const upcomingDates = useMemo(() => getUpcomingDates(new Date(`${todayInputValue}T00:00:00`)), [todayInputValue]);
  const isImmediateBookingAvailable = isWithinImmediateBookingHours(new Date(currentTimestamp));
  const isFromServiceDetail = Boolean(
    (location.state as { fromServiceDetail?: boolean } | null)?.fromServiceDetail,
  );

  useEffect(() => {
    let interval: number | undefined;
    const updateCurrentTime = () => {
      const now = new Date();
      const booking = useBookingStore.getState();
      if (booking.isScheduleAutomatic && booking.orderType === 'scheduled') {
        const nextScheduledAt = getDefaultScheduledAt(now);
        if (nextScheduledAt !== booking.scheduledAt) {
          booking.setScheduledAt(nextScheduledAt, true);
        }
      }
      setCurrentTimestamp(now.getTime());
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') updateCurrentTime();
    };
    const timeout = window.setTimeout(() => {
      updateCurrentTime();
      interval = window.setInterval(updateCurrentTime, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    window.addEventListener('focus', updateCurrentTime);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
      window.removeEventListener('focus', updateCurrentTime);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (orderType === 'urgent' || orderType === 'recurring') {
      setOrderType(orderType === 'urgent' ? 'normal' : 'scheduled');
      setPreferredProviderId(undefined);
    }
  }, [orderType, setOrderType, setPreferredProviderId]);

  useEffect(() => {
    if (scheduleInitialized.current || orderType !== 'scheduled') return;
    scheduleInitialized.current = true;
    if (scheduledAt && !isScheduleAutomatic) return;
    const initialScheduledAt = getInitialScheduledAt(scheduledAt);
    if (initialScheduledAt !== scheduledAt) {
      setScheduledAt(initialScheduledAt, true);
      setPreferredProviderId(undefined);
    }
  }, [orderType, scheduledAt, isScheduleAutomatic, setScheduledAt, setPreferredProviderId]);

  const handleUploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const availableSlots = Math.max(4 - customerAttachments.length, 0);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (selectedFiles.length === 0) {
      setUploadError('Bạn chỉ có thể tải lên tối đa 4 ảnh.');
      return;
    }

    const validationResults = await Promise.all(selectedFiles.map(validateImageFile));
    const validFiles = selectedFiles.filter((_, index) => !validationResults[index]);
    const rejectedMessages = validationResults.filter(
      (message): message is string => Boolean(message),
    );

    if (validFiles.length === 0) {
      setUploadError(`${rejectedMessages.join(' ')} Vui lòng tải ảnh rõ nét về hiện trạng thiết bị, máy móc hoặc khu vực cần sửa.`);
      return;
    }

    try {
      setIsUploadingImages(true);
      setUploadError(null);
      const uploadResults = await Promise.allSettled(
        validFiles.map((file) => bookingApi.uploadOrderAttachment(file, 'order_problem')),
      );

      const uploadedUrls = uploadResults.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
      uploadResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          rejectedMessages.push(
            `"${validFiles[index].name}": ${getUploadErrorMessage(result.reason)}`,
          );
        }
      });

      if (uploadedUrls.length > 0) {
        setCustomerAttachments([...customerAttachments, ...uploadedUrls]);
      }
      if (rejectedMessages.length > 0) {
        setUploadError(rejectedMessages.join(' '));
      }
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveAttachment = (url: string) => {
    setCustomerAttachments(customerAttachments.filter((item) => item !== url));
  };

  const handleOrderTypeChange = (type: 'normal' | 'scheduled') => {
    setCurrentTimestamp(Date.now());
    if (type === orderType) return;
    setOrderType(type);
    setPreferredProviderId(undefined);
    setProviderAvailability('idle');
    if (type === 'normal') setScheduledAt('');
  };

  const shouldShowSchedulePicker = orderType === 'scheduled';

  const clearFormError = useCallback((field: keyof Step2FormErrors) => {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  }, []);

  const handleSelectAddress = useCallback(
    (address: UserAddress | null) => {
      setAddressId(address?.id || '');
      setProviderAvailability('idle');
      clearFormError('addressId');
    },
    [clearFormError, setAddressId],
  );

  const validateStep = () => {
    const scheduleDate = scheduledAt ? scheduledAt.split('T')[0] : '';
    const nextErrors: Step2FormErrors = {};

    if (!addressId) {
      nextErrors.addressId = 'Vui lòng chọn địa chỉ thực hiện dịch vụ.';
    }


    if (orderType === 'normal' && !isWithinImmediateBookingHours(new Date())) {
      nextErrors.scheduledAt = 'Đặt ngay chỉ khả dụng từ 08:00 đến 21:00. Vui lòng chọn Hẹn giờ.';
    }

    if (shouldShowSchedulePicker && !scheduleDate) {
      nextErrors.scheduledAt = 'Vui lòng chọn ngày thực hiện dịch vụ.';
    } else if (shouldShowSchedulePicker && !scheduledAt?.includes('T')) {
      nextErrors.scheduledAt = 'Vui lòng chọn khung giờ thực hiện dịch vụ.';
    } else if (scheduleDate && scheduleDate < todayInputValue) {
      nextErrors.scheduledAt = 'Ngày thực hiện không được nhỏ hơn ngày hiện tại.';
    }
    if (shouldShowSchedulePicker && scheduledAt?.includes('T')
      && (new Date(scheduledAt).getHours() < 8
        || new Date(scheduledAt).getHours() > 21
        || (new Date(scheduledAt).getHours() === 21 && (
          new Date(scheduledAt).getMinutes() > 0
          || new Date(scheduledAt).getSeconds() > 0
          || new Date(scheduledAt).getMilliseconds() > 0
        ))
        || new Date(scheduledAt).getTime() < getEarliestScheduledAt().getTime())) {
      nextErrors.scheduledAt = 'Vui lòng chọn giờ từ 08:00 đến 21:00 và không sớm hơn phút hiện tại.';
    }
    // Đơn có lịch hẹn không còn bắt buộc khách tự chọn chuyên gia — hệ thống tự
    // điều phối. Chỉ cần có chuyên gia phù hợp là qua được bước này.
    if (providerAvailability !== 'available') {
      nextErrors.preferredProviderId = providerAvailability === 'loading' || providerAvailability === 'idle'
        ? 'Vui lòng chờ hệ thống kiểm tra chuyên gia phù hợp.'
        : shouldShowSchedulePicker
          ? 'Chưa có thợ đang nhận đơn phù hợp với dịch vụ, địa chỉ và lịch đã chọn.'
          : 'Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateStep()) return;
    navigate('/customer/bookings/new/payment', {
      state: { immediateBookingAt: orderType === 'normal' ? new Date().toISOString() : undefined },
    });
  };

  return {
    serviceId, addressId, preferredProviderId, preferredProviderName, requestedProviderId, orderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    customerAttachments, setPreferredProviderId,
    isUploadingImages, uploadError, formErrors, currentTimestamp, providerAvailability,
    todayInputValue, upcomingDates, isFromServiceDetail, isImmediateBookingAvailable,
    shouldShowSchedulePicker,
    handleUploadImages, handleRemoveAttachment, handleOrderTypeChange, clearFormError,
    handleSelectAddress, handleContinue, setProviderAvailability,
  };
};
