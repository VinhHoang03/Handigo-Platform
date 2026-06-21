import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { bookingApi } from '../../../api/booking';
import { useBookingStore } from '../hooks/useBookingStore';
import type { Address } from '../../../types/booking';
import { useAuthStore } from '@/features/auth/store/auth.store';

const timeSlots = ['08:00 - 10:00', '10:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00'];

const emptyAddressForm = {
  recipientName: '',
  recipientPhone: '',
  fullAddress: '',
  ward: '',
  province: '',
  note: '',
  isDefault: false,
};

const CreateBookingStep2Page = () => {
  const user = useAuthStore((state) => state.user);
  const {
    addressId, setAddressId, orderType, setOrderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    customerAttachments, setCustomerAttachments,
  } = useBookingStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressForm, setAddressForm] = useState(() => ({
    ...emptyAddressForm,
    recipientName: user?.fullName || '',
    recipientPhone: user?.phone || '',
  }));
  const [isCreatingAddress, setIsCreatingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    bookingApi.getAddresses().then(data => {
      setAddresses(data);
      if (data.length > 0 && !addressId) {
        setAddressId(data[0]._id);
      }
    });
    // Chỉ tải danh sách địa chỉ khi mở màn hình.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateAddress = async (event: FormEvent) => {
    event.preventDefault();
    setIsCreatingAddress(true);
    setAddressError('');

    try {
      const createdAddress = await bookingApi.createAddress({
        recipientName: addressForm.recipientName.trim(),
        recipientPhone: addressForm.recipientPhone.trim(),
        fullAddress: addressForm.fullAddress.trim(),
        ward: addressForm.ward.trim(),
        province: addressForm.province.trim(),
        note: addressForm.note.trim() || null,
        isDefault: addressForm.isDefault,
      });

      setAddresses((current) => [
        createdAddress,
        ...current.filter((address) => address._id !== createdAddress._id),
      ]);
      setAddressId(createdAddress._id);
      setAddressForm({
        ...emptyAddressForm,
        recipientName: user?.fullName || '',
        recipientPhone: user?.phone || '',
      });
      setIsAddressModalOpen(false);
    } catch (error) {
      if (typeof error === 'object' && error && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string } } }).response;
        if (response?.data?.message) {
          setAddressError(response.data.message);
          return;
        }
      }
      setAddressError('Không thể thêm địa chỉ. Vui lòng thử lại.');
    } finally {
      setIsCreatingAddress(false);
    }
  };

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
            <div className="flex items-center justify-between gap-md mb-sm">
              <h2 className="font-headline-sm text-headline-sm text-primary">Thông tin thực hiện</h2>
              <button
                type="button"
                onClick={() => {
                  setAddressError('');
                  setIsAddressModalOpen(true);
                }}
                className="text-primary font-label-sm hover:underline flex items-center gap-xs"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Thêm địa chỉ
              </button>
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

              <div>
                <label className="block font-bold mb-xs text-on-surface-variant text-xs uppercase tracking-wider">
                  Địa chỉ của bạn
                </label>
                <div className="space-y-sm max-h-[150px] overflow-y-auto pr-1">
                  {addresses.map((addr) => (
                    <label key={addr._id} className="group relative block cursor-pointer">
                      <input
                        checked={addressId === addr._id}
                        onChange={() => setAddressId(addr._id)}
                        className="peer sr-only"
                        name="address"
                        type="radio"
                      />
                      <div className="p-sm rounded-2xl border-2 border-outline-variant peer-checked:border-primary peer-checked:bg-primary-container/10 transition-all hover:border-primary/50">
                        <div className="flex items-start gap-sm">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${addressId === addr._id ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary'}`}>
                            <span className="material-symbols-outlined text-[20px]">
                              {addr.label === 'Nhà' ? 'home' : addr.label === 'Văn phòng' ? 'work' : 'location_on'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm">{addr.label || (addr.isDefault ? 'Địa chỉ mặc định' : 'Địa chỉ')}</p>
                            <p className="text-xs text-on-surface-variant leading-snug mt-0.5 line-clamp-2">
                              {addr.fullAddress || addr.detailAddress}, {addr.ward}
                            </p>
                            {(addr.recipientName || addr.recipientPhone) && (
                              <p className="mt-1 truncate text-[11px] text-on-surface-variant">
                                Người nhận: {addr.recipientName || "Chưa cập nhật"}
                                {addr.recipientPhone ? ` • ${addr.recipientPhone}` : ""}
                              </p>
                            )}
                            <p className="text-[10px] text-on-surface-variant/70 uppercase font-medium mt-1 truncate">
                              {[addr.district, addr.province].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                  {addresses.length === 0 && (
                    <p className="text-on-surface-variant p-sm bg-surface-container-low rounded-2xl border border-dashed border-outline-variant">
                      Bạn chưa có địa chỉ nào. Vui lòng thêm địa chỉ mới.
                    </p>
                  )}
                </div>
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

      <Modal
        open={isAddressModalOpen}
        title="Thêm địa chỉ mới"
        onClose={() => {
          if (!isCreatingAddress) setIsAddressModalOpen(false);
        }}
      >
        <form onSubmit={handleCreateAddress} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Tên người nhận</span>
              <input
                required
                value={addressForm.recipientName}
                placeholder="Nhập tên người nhận"
                className="form-field__input pb-2 pt-2"
                onChange={(event) => setAddressForm({ ...addressForm, recipientName: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Số điện thoại người nhận</span>
              <input
                required
                type="tel"
                value={addressForm.recipientPhone}
                placeholder="Nhập số điện thoại"
                className="form-field__input pb-2 pt-2"
                onChange={(event) => setAddressForm({ ...addressForm, recipientPhone: event.target.value })}
              />
            </label>
          </div>
          <AddressInput
            label="Địa chỉ chi tiết"
            placeholder="Số nhà, tên đường"
            value={addressForm.fullAddress}
            onChange={(value) => setAddressForm({ ...addressForm, fullAddress: value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AddressInput
              label="Phường/Xã"
              placeholder="Nhập phường hoặc xã"
              value={addressForm.ward}
              onChange={(value) => setAddressForm({ ...addressForm, ward: value })}
            />
            <AddressInput
              label="Tỉnh/Thành phố"
              placeholder="Nhập tỉnh hoặc thành phố"
              value={addressForm.province}
              onChange={(value) => setAddressForm({ ...addressForm, province: value })}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Ghi chú</span>
            <textarea
              rows={3}
              value={addressForm.note}
              onChange={(event) => setAddressForm({ ...addressForm, note: event.target.value })}
              placeholder="Ví dụ: Gọi trước khi đến"
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
            <input
              type="checkbox"
              checked={addressForm.isDefault}
              onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })}
              className="h-5 w-5 accent-primary"
            />
            <span className="font-semibold">Đặt làm địa chỉ mặc định</span>
          </label>
          {addressError && (
            <p className="rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
              {addressError}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isCreatingAddress}
              onClick={() => setIsAddressModalOpen(false)}
              className="rounded-xl bg-surface-container-high px-5 py-2.5 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreatingAddress}
              className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50"
            >
              {isCreatingAddress ? 'Đang lưu...' : 'Lưu địa chỉ'}
            </button>
          </div>
        </form>
      </Modal>
    </OrderCreationShell>
  );
};

function AddressInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

export default CreateBookingStep2Page;
