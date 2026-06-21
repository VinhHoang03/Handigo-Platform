import { useCallback, useState } from 'react';
import { AddressBookManager } from '@/components/profile/AddressBookManager';
import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { bookingApi } from '../../../api/booking';
import { useBookingStore } from '../hooks/useBookingStore';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { UserAddress } from '@/features/profile/types/profile.types';

const timeSlots = ['08:00 - 10:00', '10:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00'];

const CreateBookingStep2Page = () => {
  const user = useAuthStore((state) => state.user);
  const {
    addressId, setAddressId, orderType, setOrderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    customerAttachments, setCustomerAttachments,
  } = useBookingStore();
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const handleSelectAddress = useCallback(
    (address: UserAddress | null) => setAddressId(address?.id),
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

    try {
      setIsUploadingImages(true);
      setUploadError(null);
      const uploadedUrls = await Promise.all(
        selectedFiles.map((file) => bookingApi.uploadOrderAttachment(file)),
      );
      setCustomerAttachments([...customerAttachments, ...uploadedUrls]);
    } catch {
      setUploadError('Không thể tải ảnh lên. Vui lòng thử lại.');
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
                  onChange={(event) => setProblemDescription(event.target.value)}
                />
              </div>

              <AddressBookManager
                compact
                selectable
                selectedAddressId={addressId}
                defaultRecipient={{
                  name: user?.fullName || '',
                  phone: user?.phone || '',
                }}
                onSelectAddress={handleSelectAddress}
              />
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
                    accept="image/*"
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
                Tải lên tối đa 4 ảnh để chuyên gia dễ hình dung vấn đề.
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
                    onChange={() => handleOrderTypeChange(type)}
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
                    className="w-full p-sm rounded-2xl border border-outline-variant focus:border-primary outline-none bg-surface-container-lowest"
                    value={scheduledAt ? scheduledAt.split('T')[0] : ''}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
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
                        onClick={() => {
                          if (scheduledAt) {
                            const date = scheduledAt.split('T')[0];
                            setScheduledAt(`${date}T${slot.split(' ')[0]}:00`);
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

        <OrderSummaryCard step={2} actionLabel="Tiếp tục bước 3" actionTo="/customer/bookings/new/payment" />
      </div>

    </OrderCreationShell>
  );
};

export default CreateBookingStep2Page;
