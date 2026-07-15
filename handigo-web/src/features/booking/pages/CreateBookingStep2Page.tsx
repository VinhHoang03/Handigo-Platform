import axios from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddressBookManager } from '@/features/profile/components/AddressBookManager';
import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { bookingApi } from '@/features/booking/api/booking.api';
import { useBookingStore } from '../hooks/useBookingStore';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { UserAddress } from '@/features/profile/types/profile.types';

const timeSlots = ['08:00 - 10:00', '10:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00'];
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MIN_IMAGE_WIDTH = 320;
const MIN_IMAGE_HEIGHT = 240;

type Step2FormErrors = {
  addressId?: string;
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
  const user = useAuthStore((state) => state.user);
  const {
    addressId, setAddressId, orderType, setOrderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    customerAttachments, setCustomerAttachments,
  } = useBookingStore();
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Step2FormErrors>({});
  const todayInputValue = useMemo(() => getTodayInputValue(), []);

  const handleSelectAddress = useCallback(
    (address: UserAddress | null) => setAddressId(address?.id || ''),
    [setAddressId],
  );

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
        selectedFiles.map((file) => bookingApi.uploadOrderAttachment(file)),
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
    if (type === 'normal') setScheduledAt('');
  };

  const shouldShowSchedulePicker = orderType !== 'normal';

  const clearFormError = (field: keyof Step2FormErrors) => {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

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
    } else if (scheduleDate && scheduleDate < todayInputValue) {
      nextErrors.scheduledAt = 'Ngày thực hiện không được nhỏ hơn ngày hiện tại.';
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2 space-y-md">
          <section className="bg-white rounded-2xl p-sm shadow-sm border border-outline-variant/30">
            <div className="mb-sm flex items-center justify-between gap-md">
              <h2 className="font-headline-sm text-headline-sm text-primary">Thông tin thực hiện</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div>
                <label className="block font-bold mb-xs text-on-surface-variant text-xs uppercase tracking-wider">
                  Mô tả tình trạng
                </label>
                <textarea
                  className="w-full p-sm rounded-2xl border border-outline-variant focus:border-primary outline-none min-h-[150px] text-body-md bg-surface-container-lowest"
                  placeholder="Ghi chú chi tiết về tình trạng hoặc yêu cầu cụ thể..."
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

              <div>
                <AddressBookManager
                  compact
                  selectable
                  selectedAddressId={addressId}
                  defaultRecipient={{
                    name: user?.fullName || '',
                    phone: user?.phone || '',
                  }}
                  onSelectAddress={(address) => {
                    handleSelectAddress(address);
                    clearFormError('addressId');
                  }}
                />
                {formErrors.addressId && (
                  <p className="mt-xs text-xs font-medium text-red-600">{formErrors.addressId}</p>
                )}
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
                    {isUploadingImages ? 'Đang tải...' : 'Tải ảnh'}
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

          <section className="bg-white rounded-2xl p-sm shadow-sm border border-outline-variant/30">
            <h2 className="font-headline-sm text-headline-sm text-primary mb-sm">Thời gian thực hiện</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
              {[
                { icon: 'bolt', type: 'normal' as const, title: 'Đặt lịch ngay', desc: 'Có mặt sớm nhất' },
                { icon: 'event', type: 'scheduled' as const, title: 'Lên lịch hẹn', desc: 'Chọn giờ cụ thể' },
                { icon: 'update', type: 'recurring' as const, title: 'Đặt định kỳ', desc: 'Lặp lại mỗi tuần' },
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
                  <div className="p-sm rounded-2xl border-2 border-outline-variant peer-checked:border-primary peer-checked:bg-primary-container/5 text-center transition-all h-full flex flex-col items-center">
                    <span className="material-symbols-outlined text-2xl mb-xs">{icon}</span>
                    <p className="font-bold text-sm">{title}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {shouldShowSchedulePicker && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md mt-md pt-md border-t border-outline-variant/30">
                <div>
                  <p className="font-bold mb-xs flex items-center gap-xs text-sm">
                    <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                    Ngày thực hiện
                  </p>
                  <input
                    type="date"
                    min={todayInputValue}
                    className="w-full p-sm rounded-2xl border border-outline-variant focus:border-primary outline-none bg-surface-container-lowest"
                    value={scheduledAt ? scheduledAt.split('T')[0] : ''}
                    onChange={(event) => {
                      setScheduledAt(event.target.value);
                      clearFormError('scheduledAt');
                    }}
                  />
                  {formErrors.scheduledAt && (
                    <p className="mt-xs text-xs font-medium text-red-600">{formErrors.scheduledAt}</p>
                  )}
                </div>
                <div>
                  <p className="font-bold mb-xs flex items-center gap-xs text-sm">
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                    Khung giờ gợi ý
                  </p>
                  <div className="grid grid-cols-2 gap-sm">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          if (scheduledAt) {
                            const date = scheduledAt.split('T')[0];
                            setScheduledAt(`${date}T${slot.split(' ')[0]}:00`);
                            clearFormError('scheduledAt');
                          }
                        }}
                        className={`py-2 rounded-xl transition-colors text-xs font-medium ${scheduledAt?.includes(slot.split(' ')[0])
                          ? 'border border-primary bg-primary-container/10 text-primary font-bold'
                          : 'border border-outline-variant hover:border-primary'
                          }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <OrderSummaryCard step={2} actionLabel="Tiếp tục bước 3" onAction={handleContinue} />
      </div>

    </OrderCreationShell>
  );
};

export default CreateBookingStep2Page;

