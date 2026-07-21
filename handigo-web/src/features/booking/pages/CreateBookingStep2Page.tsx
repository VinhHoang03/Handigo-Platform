import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AddressBookManager } from '@/features/profile/components/AddressBookManager';
import { NearbyProviderSelector } from '@/features/customer-service/components/NearbyProviderSelector';
import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { bookingApi } from '@/features/booking/api/booking.api';
import { useBookingStore } from '../hooks/useBookingStore';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { UserAddress } from '@/features/profile/types/profile.types';

const timeSlots = Array.from({ length: 10 }, (_, index) => {
  const startHour = 8 + index;
  return `${String(startHour).padStart(2, '0')}:00`;
});
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MIN_IMAGE_WIDTH = 320;
const MIN_IMAGE_HEIGHT = 240;

type Step2FormErrors = {
  addressId?: string;
  preferredProviderId?: string;
  problemDescription?: string;
  scheduledAt?: string;
};

const getUploadErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || 'Không thể tải ảnh lên. Vui lòng thử lại.';
  }
  return 'Không thể tải ảnh lên. Vui lòng thử lại.';
};

const getTodayInputValue = () => {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().split('T')[0];
};

const getUpcomingDates = () =>
  Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return {
      value: new Date(date.getTime() - timezoneOffset).toISOString().split('T')[0],
      weekday: new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date),
      day: new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(date),
      month: new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(date),
    };
  });

const buildRecurringPreview = (
  scheduledAt: string | undefined,
  unit: 'weekly' | 'monthly',
  count: number,
) => {
  if (!scheduledAt?.includes('T')) return [];
  const start = new Date(scheduledAt);
  return Array.from({ length: count }, (_, index) => {
    const occurrence = new Date(start);
    if (unit === 'weekly') {
      occurrence.setDate(start.getDate() + index * 7);
    } else {
      const targetDay = start.getDate();
      occurrence.setDate(1);
      occurrence.setMonth(start.getMonth() + index);
      const lastDay = new Date(
        occurrence.getFullYear(),
        occurrence.getMonth() + 1,
        0,
      ).getDate();
      occurrence.setDate(Math.min(targetDay, lastDay));
    }
    return occurrence;
  });
};

const validateImageFile = (file: File) => new Promise<string | null>((resolve) => {
  if (!file.type.startsWith('image/')) {
    resolve(`"${file.name}" không phải là tệp ảnh hợp lệ.`);
    return;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    resolve(`"${file.name}" vượt quá dung lượng 5MB.`);
    return;
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(imageUrl);
    if (image.naturalWidth < MIN_IMAGE_WIDTH || image.naturalHeight < MIN_IMAGE_HEIGHT) {
      resolve(`"${file.name}" có độ phân giải quá thấp.`);
      return;
    }
    resolve(null);
  };
  image.onerror = () => {
    URL.revokeObjectURL(imageUrl);
    resolve(`"${file.name}" không thể đọc nội dung ảnh.`);
  };
  image.src = imageUrl;
});

const CreateBookingStep2Page = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
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
    if (shouldShowSchedulePicker && !preferredProviderId) {
      nextErrors.preferredProviderId = 'Vui lòng chọn chuyên gia còn trống cho lịch hẹn.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateStep()) return;
    navigate('/customer/bookings/new/payment');
  };

  return (
    <OrderCreationShell>
      <BookingStepper currentStep={2} />

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-md">
          <section className="rounded-2xl border border-outline-variant/30 bg-white p-md shadow-sm">
            <div className="mb-sm flex items-center justify-between gap-md">
              <h2 className="font-headline-sm text-headline-sm text-primary">Thông tin thực hiện</h2>
            </div>

            <div className="space-y-md">
              <div>
                <AddressBookManager
                  compact
                  selectable
                  singleAddressMode={isFromServiceDetail}
                  selectedAddressId={addressId}
                  defaultRecipient={{
                    name: user?.fullName || '',
                    phone: user?.phone || '',
                  }}
                  onSelectAddress={handleSelectAddress}
                />
                {formErrors.addressId && (
                  <p className="mt-xs text-xs font-medium text-red-600">{formErrors.addressId}</p>
                )}
              </div>

              <div>
                <label htmlFor="problem-description" className="block font-bold mb-xs text-on-surface-variant text-xs uppercase tracking-wider">
                  Mô tả tình trạng
                </label>
                <textarea
                  id="problem-description"
                  name="problemDescription"
                  autoComplete="off"
                  className="w-full p-sm rounded-2xl border border-outline-variant focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 outline-none min-h-[150px] text-body-md bg-surface-container-lowest"
                  placeholder="Ghi chú chi tiết về tình trạng hoặc yêu cầu cụ thể…"
                  value={problemDescription || ''}
                  onChange={(event) => {
                    setProblemDescription(event.target.value);
                    clearFormError('problemDescription');
                  }}
                />
                {formErrors.problemDescription && (
                  <p className="mt-xs text-xs font-medium text-red-600">{formErrors.problemDescription}</p>
                )}
                <p className="mt-xs text-[10px] text-on-surface-variant italic">
                  Mô tả tối thiểu {MIN_DESCRIPTION_LENGTH} ký tự để provider nắm rõ tình trạng.
                </p>
              </div>
            </div>
            <div className="mt-md pt-md border-t border-outline-variant/30">
              <label className="block font-bold mb-xs text-on-surface-variant text-xs uppercase tracking-wider">
                Ảnh hiện trạng
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-sm">
                <label className={`aspect-[4/3] rounded-2xl border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors group bg-surface-container-lowest ${isUploadingImages ? 'pointer-events-none opacity-60' : ''}`}>
                  <span className={`material-symbols-outlined text-primary transition-transform ${isUploadingImages ? 'animate-spin' : 'group-hover:scale-110'}`}>
                    {isUploadingImages ? 'progress_activity' : 'add_a_photo'}
                  </span>
                  <span className="mt-1 text-xs font-bold text-primary">
                    {isUploadingImages ? 'Đang tải…' : 'Tải ảnh'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    disabled={isUploadingImages || customerAttachments.length >= 4}
                    onChange={(event) => {
                      void handleUploadImages(event.target.files);
                      event.target.value = '';
                    }}
                  />
                </label>

                {customerAttachments.map((url) => (
                  <div key={url} className="aspect-[4/3] rounded-2xl overflow-hidden relative group shadow-sm border border-outline-variant/30">
                    <img src={url} className="w-full h-full object-cover" alt="Ảnh hiện trạng" />
                    <button
                      type="button"
                      aria-label="Xóa ảnh hiện trạng"
                      onClick={() => handleRemoveAttachment(url)}
                      className="absolute top-1 right-1 bg-black/55 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                ))}
              </div>
              {uploadError && <p className="text-xs text-red-600 mt-xs">{uploadError}</p>}
              <p className="text-[10px] text-on-surface-variant mt-xs italic">
                Tải lên tối đa 4 ảnh JPG, PNG hoặc WebP, mỗi ảnh tối đa 5MB. Ảnh nên thể hiện rõ thiết bị, máy móc hư hỏng hoặc khu vực cần sửa.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant/30 bg-white p-md shadow-sm">
            <h2 className="font-headline-sm text-headline-sm text-primary mb-sm">Thời gian thực hiện</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
              {[
                { icon: 'bolt', type: 'normal' as const, title: 'Đặt lịch ngay', desc: 'Có mặt sớm nhất' },
                { icon: 'event', type: 'scheduled' as const, title: 'Lên lịch hẹn', desc: 'Chọn giờ cụ thể' },
                { icon: 'update', type: 'recurring' as const, title: 'Đặt định kỳ', desc: 'Theo tuần hoặc tháng' },
              ].map(({ icon, type, title, desc }) => (
                <label key={title} className="cursor-pointer">
                  <input
                    checked={orderType === type}
                    onChange={() => {
                      handleOrderTypeChange(type);
                      clearFormError('scheduledAt');
                    }}
                    className="peer sr-only"
                    name="booking_type"
                    type="radio"
                  />
                  <div className="p-sm rounded-2xl border-2 border-outline-variant peer-checked:border-primary peer-checked:bg-primary-container/5 peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15 text-center transition-colors h-full flex flex-col items-center">
                    <span className="material-symbols-outlined text-2xl mb-xs">{icon}</span>
                    <p className="font-bold text-sm">{title}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {shouldShowSchedulePicker && (
              <div className="mt-md border-t border-outline-variant/30 pt-md">
                <div className="mb-md flex items-start gap-sm rounded-xl bg-primary-container/10 p-sm">
                  <span aria-hidden="true" className="material-symbols-outlined text-primary">event_available</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface">Đặt trước chuyên gia theo lịch của bạn</p>
                    <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                      Chọn thời gian trước để Handigo chỉ hiển thị những chuyên gia còn lịch trống.
                      Bạn chưa cần thanh toán ở bước này.
                    </p>
                  </div>
                </div>

                <div className="space-y-lg">
                  {orderType === 'recurring' && (
                    <fieldset className="rounded-xl border border-outline-variant/40 p-sm">
                      <legend className="flex items-center gap-sm px-xs text-sm font-bold text-on-surface">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">1</span>
                        Thiết lập chu kỳ
                      </legend>
                      <div className="mt-sm grid gap-md lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                        <div>
                          <p className="mb-xs text-xs font-bold uppercase tracking-wide text-on-surface-variant">Lặp lại</p>
                          <div className="grid grid-cols-2 gap-xs">
                            {(['weekly', 'monthly'] as const).map((unit) => (
                              <button
                                key={unit}
                                type="button"
                                aria-pressed={recurrenceUnit === unit}
                                onClick={() => {
                                  setRecurrenceUnit(unit);
                                  setRecurrenceCount(unit === 'weekly' ? 1 : 4);
                                  setPreferredProviderId(undefined);
                                }}
                                className={`min-h-11 rounded-xl border px-sm text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${recurrenceUnit === unit
                                  ? 'border-primary bg-primary text-on-primary'
                                  : 'border-outline-variant hover:border-primary hover:text-primary'
                                  }`}
                              >
                                {unit === 'weekly' ? 'Hằng tuần' : 'Hằng tháng'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-xs text-xs font-bold uppercase tracking-wide text-on-surface-variant">Số buổi</p>
                          <div className={`grid gap-xs ${recurrenceUnit === 'weekly' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                            {recurrenceCountOptions.map((count) => (
                              <button
                                key={count}
                                type="button"
                                aria-pressed={recurrenceCount === count}
                                onClick={() => {
                                  setRecurrenceCount(count);
                                  setPreferredProviderId(undefined);
                                }}
                                className={`min-h-11 rounded-xl border px-xs text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${recurrenceCount === count
                                  ? 'border-primary bg-primary text-on-primary'
                                  : 'border-outline-variant hover:border-primary hover:text-primary'
                                  }`}
                              >
                                {count} buổi
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  )}

                  <fieldset>
                    <legend className="mb-sm flex items-center gap-sm text-sm font-bold text-on-surface">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">{orderType === 'recurring' ? 2 : 1}</span>
                      Chọn ngày thực hiện
                    </legend>
                    <div className="grid gap-md xl:grid-cols-[17rem_minmax(0,1fr)] xl:items-start">
                      <label className="flex min-w-0 flex-col gap-xs rounded-xl bg-surface-container-low p-sm text-xs font-bold text-on-surface-variant">
                        Chọn ngày bất kỳ
                        <input
                          type="date"
                          name="appointmentDate"
                          autoComplete="off"
                          min={todayInputValue}
                          className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-sm text-base text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                          value={scheduledAt ? scheduledAt.split('T')[0] : ''}
                          onChange={(event) => {
                            setScheduledAt(event.target.value);
                            setPreferredProviderId(undefined);
                            clearFormError('scheduledAt');
                          }}
                        />
                        <span className="font-normal leading-5">
                          Bạn có thể chọn mọi ngày trong tương lai, không giới hạn trong danh sách gợi ý.
                        </span>
                      </label>

                      <div>
                        <p className="mb-xs text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                          Hoặc chọn nhanh trong 14 ngày tới
                        </p>
                        <div className="grid grid-cols-4 gap-xs sm:grid-cols-7">
                          {upcomingDates.map((date) => {
                            const isSelected = scheduledAt?.split('T')[0] === date.value;
                            return (
                              <button
                                key={date.value}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => {
                                  setScheduledAt(date.value);
                                  setPreferredProviderId(undefined);
                                  clearFormError('scheduledAt');
                                }}
                                className={`min-h-20 rounded-xl border px-xs py-sm text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${isSelected
                                  ? 'border-primary bg-primary text-on-primary'
                                  : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary'
                                  }`}
                              >
                                <span className="block text-[11px] font-medium uppercase">{date.weekday}</span>
                                <span className="my-1 block text-xl font-bold leading-none">{date.day}</span>
                                <span className="block text-[11px]">{date.month}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="mb-sm flex items-center gap-sm text-sm font-bold text-on-surface">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">{orderType === 'recurring' ? 3 : 2}</span>
                      Chọn khung giờ
                    </legend>
                    <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
                      {timeSlots.map((slot) => {
                        const startTime = slot.split(' ')[0];
                        const isSelected = scheduledAt?.includes(`T${startTime}`);
                        const selectedDate = scheduledAt?.split('T')[0];
                        const isPastSlot = selectedDate
                          ? new Date(`${selectedDate}T${startTime}:00`).getTime() <= currentTimestamp
                          : false;
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={!scheduledAt || isPastSlot}
                            aria-pressed={isSelected}
                            onClick={() => {
                              if (!scheduledAt) return;
                              const date = scheduledAt.split('T')[0];
                              setScheduledAt(`${date}T${startTime}:00`);
                              setPreferredProviderId(undefined);
                              clearFormError('scheduledAt');
                            }}
                            className={`min-h-12 rounded-xl border px-sm py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-40 ${isSelected
                              ? 'border-primary bg-primary text-on-primary'
                              : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary hover:text-primary'
                              }`}
                          >
                            {slot}
                            {isPastSlot && (
                              <span className="mt-1 block text-[10px] font-medium">Đã qua</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {formErrors.scheduledAt && (
                      <p role="alert" className="mt-xs text-xs font-medium text-red-600">{formErrors.scheduledAt}</p>
                    )}
                  </fieldset>

                  {orderType === 'recurring' && recurringPreview.length > 0 && (
                    <div className="rounded-xl bg-surface-container-low p-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                        Các buổi dự kiến
                      </p>
                      <div className="mt-xs grid gap-xs sm:grid-cols-2 xl:grid-cols-3">
                        {recurringPreview.map((date, index) => (
                          <div key={date.toISOString()} className="flex items-center gap-xs text-sm text-on-surface">
                            <span className="font-bold text-primary">{index + 1}.</span>
                            {date.toLocaleString('vi-VN')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <fieldset>
                    <legend className="mb-sm flex items-center gap-sm text-sm font-bold text-on-surface">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">{orderType === 'recurring' ? 4 : 3}</span>
                      Chọn chuyên gia
                    </legend>
                    <NearbyProviderSelector
                      serviceId={serviceId}
                      addressId={addressId}
                      scheduledAt={scheduledAt?.includes('T') ? scheduledAt : undefined}
                      recurrenceUnit={orderType === 'recurring' ? recurrenceUnit : undefined}
                      recurrenceCount={orderType === 'recurring' ? recurrenceCount : undefined}
                      requireSelection
                      selectedProviderId={preferredProviderId}
                      requestedProviderId={requestedProviderId}
                      onSelectProvider={(providerId, providerName) => {
                        setPreferredProviderId(providerId, providerName);
                        clearFormError('preferredProviderId');
                      }}
                    />
                    {formErrors.preferredProviderId && (
                      <p role="alert" className="mt-xs text-xs font-medium text-red-600">
                        {formErrors.preferredProviderId}
                      </p>
                    )}
                  </fieldset>
                </div>
              </div>
            )}

            {!shouldShowSchedulePicker && <div className="mt-md">
              <NearbyProviderSelector
                serviceId={serviceId}
                addressId={addressId}
                selectedProviderId={preferredProviderId}
                requestedProviderId={requestedProviderId}
                onSelectProvider={(providerId, providerName) => {
                  setPreferredProviderId(providerId, providerName);
                  clearFormError('preferredProviderId');
                }}
              />
            </div>}
          </section>
        </div>

        <OrderSummaryCard
          step={2}
          actionLabel={shouldShowSchedulePicker ? "Xác nhận" : "Tiếp tục bước 3"}
          onAction={handleContinue}
        />
      </div>

    </OrderCreationShell>
  );
};

export default CreateBookingStep2Page;

