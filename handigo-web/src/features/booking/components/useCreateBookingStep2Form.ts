import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingApi } from '@/features/booking/api/booking.api';
import { useBookingStore } from '../hooks/useBookingStore';
import type { UserAddress } from '@/features/profile/types/profile.types';
import type { ProviderAvailabilityStatus } from '@/features/customer-service/components/NearbyProviderSelector';
import {
  type Step2FormErrors,
  MIN_DESCRIPTION_LENGTH,
  buildRecurringPreview,
  getTodayInputValue,
  getUpcomingDates,
  getUploadErrorMessage,
  validateImageFile,
} from './step2Helpers';

/** State + handlers cho CreateBookingStep2Page — tách khỏi trang để giữ dưới 200 dòng. */
export const useCreateBookingStep2Form = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    serviceId, addressId, setAddressId,
    preferredProviderId, setPreferredProviderId,
    requestedProviderId,
    orderType, setOrderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    recurrenceUnit = 'weekly', setRecurrenceUnit,
    recurrenceCount = 1, setRecurrenceCount,
    customerAttachments, setCustomerAttachments,
  } = useBookingStore();
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Step2FormErrors>({});
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [providerAvailability, setProviderAvailability] = useState<ProviderAvailabilityStatus>('idle');
  const todayInputValue = useMemo(() => getTodayInputValue(), []);
  const upcomingDates = useMemo(() => getUpcomingDates(), []);
  const recurringPreview = useMemo(
    () => buildRecurringPreview(scheduledAt, recurrenceUnit, recurrenceCount),
    [recurrenceCount, recurrenceUnit, scheduledAt],
  );
  const recurrenceCountOptions = recurrenceUnit === 'weekly'
    ? ([1, 2, 3, 4] as const)
    : ([4, 8, 12] as const);
  const isFromServiceDetail = Boolean(
    (location.state as { fromServiceDetail?: boolean } | null)?.fromServiceDetail,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const isValidCount = recurrenceUnit === 'weekly'
      ? [1, 2, 3, 4].some((count) => count === recurrenceCount)
      : [4, 8, 12].some((count) => count === recurrenceCount);
    if (!isValidCount) {
      setRecurrenceCount(recurrenceUnit === 'weekly' ? 1 : 4);
      setPreferredProviderId(undefined);
    }
  }, [recurrenceCount, recurrenceUnit, setPreferredProviderId, setRecurrenceCount]);

  const handleUploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const availableSlots = Math.max(4 - customerAttachments.length, 0);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (selectedFiles.length === 0) {
      setUploadError('Bạn chỉ có thể tải lên tối đa 4 ảnh.');
      return;
    }

    const validationMessages = (await Promise.all(selectedFiles.map(validateImageFile))).filter(Boolean);
    if (validationMessages.length > 0) {
      setUploadError(`${validationMessages.join(' ')} Vui lòng tải ảnh rõ nét về hiện trạng thiết bị, máy móc hoặc khu vực cần sửa.`);
      return;
    }

    try {
      setIsUploadingImages(true);
      setUploadError(null);
      const uploadedUrls = await Promise.all(
        selectedFiles.map((file) => bookingApi.uploadOrderAttachment(file, 'order_problem')),
      );
      setCustomerAttachments([...customerAttachments, ...uploadedUrls]);
    } catch (error) {
      setUploadError(getUploadErrorMessage(error));
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveAttachment = (url: string) => {
    setCustomerAttachments(customerAttachments.filter((item) => item !== url));
  };

  const handleOrderTypeChange = (type: 'normal' | 'scheduled' | 'recurring') => {
    setOrderType(type);
    setPreferredProviderId(undefined);
    setProviderAvailability('idle');
    if (type === 'normal') setScheduledAt('');
  };

  const shouldShowSchedulePicker = orderType !== 'normal';

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
    const description = (problemDescription || '').trim();
    const scheduleDate = scheduledAt ? scheduledAt.split('T')[0] : '';
    const nextErrors: Step2FormErrors = {};

    if (!addressId) {
      nextErrors.addressId = 'Vui lòng chọn địa chỉ thực hiện dịch vụ.';
    }

    if (description.length < MIN_DESCRIPTION_LENGTH) {
      nextErrors.problemDescription = 'Vui lòng mô tả tình trạng tối thiểu ' + MIN_DESCRIPTION_LENGTH + ' ký tự.';
    }

    if (shouldShowSchedulePicker && !scheduleDate) {
      nextErrors.scheduledAt = 'Vui lòng chọn ngày thực hiện dịch vụ.';
    } else if (shouldShowSchedulePicker && !scheduledAt?.includes('T')) {
      nextErrors.scheduledAt = 'Vui lòng chọn khung giờ thực hiện dịch vụ.';
    } else if (scheduleDate && scheduleDate < todayInputValue) {
      nextErrors.scheduledAt = 'Ngày thực hiện không được nhỏ hơn ngày hiện tại.';
    }
    // Đơn có lịch hẹn không còn bắt buộc khách tự chọn chuyên gia — hệ thống tự
    // điều phối. Chỉ cần có chuyên gia phù hợp là qua được bước này.
    if (providerAvailability !== 'available') {
      nextErrors.preferredProviderId = providerAvailability === 'loading' || providerAvailability === 'idle'
        ? 'Vui lòng chờ hệ thống kiểm tra chuyên gia phù hợp.'
        : shouldShowSchedulePicker
          ? 'Chưa có chuyên gia phù hợp và còn trống trong thời gian đã chọn.'
          : 'Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateStep()) return;
    navigate('/customer/bookings/new/payment');
  };

  return {
    serviceId, addressId, preferredProviderId, requestedProviderId, orderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    recurrenceUnit, setRecurrenceUnit, recurrenceCount, setRecurrenceCount,
    customerAttachments, setPreferredProviderId,
    isUploadingImages, uploadError, formErrors, currentTimestamp, providerAvailability,
    todayInputValue, upcomingDates, recurringPreview, recurrenceCountOptions, isFromServiceDetail,
    shouldShowSchedulePicker,
    handleUploadImages, handleRemoveAttachment, handleOrderTypeChange, clearFormError,
    handleSelectAddress, handleContinue, setProviderAvailability,
  };
};
