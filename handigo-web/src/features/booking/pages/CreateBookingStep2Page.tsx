import { useEffect, useState } from 'react';
import { BookingPageHeader, BookingShell, BookingStepper, OrderSummaryCard } from '../components/BookingComponents';
import { bookingApi } from '../../../api/booking';
import { useBookingStore } from '../hooks/useBookingStore';
import type { Address } from '../../../types/booking';

const timeSlots = ['08:00 - 10:00', '10:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00'];

const CreateBookingStep2Page = () => {
  const {
    addressId, setAddressId, orderType, setOrderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    customerAttachments, setCustomerAttachments
  } = useBookingStore();
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    bookingApi.getAddresses().then(data => {
      setAddresses(data);
      if (data.length > 0 && !addressId) {
        setAddressId(data[0]._id);
      }
    });
  }, [addressId, setAddressId]);

  return (
    <BookingShell>
      <BookingPageHeader
        title="Thời gian & địa điểm"
        description="Chọn địa chỉ thực hiện, loại hình đặt lịch và khung giờ phù hợp."
      />
      <BookingStepper currentStep={2} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
        <div className="lg:col-span-2 space-y-lg">
          <section className="bg-white rounded-3xl p-md shadow-sm border border-outline-variant/30">
            {/* Header with Address Toggle */}
            <div className="flex items-center justify-between gap-md mb-md">
              <h2 className="font-headline-md text-headline-md text-primary">Thông tin thực hiện</h2>
              <button className="text-primary font-label-md hover:underline flex items-center gap-xs">
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Thêm địa chỉ
              </button>
            </div>

            <div className="space-y-lg">
              {/* Address Selection */}
              <div>
                <label className="block font-bold mb-sm text-on-surface-variant text-sm uppercase tracking-wider">Địa chỉ của bạn</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  {addresses.map((addr) => (
                    <label key={addr._id} className="group relative block cursor-pointer">
                      <input
                        checked={addressId === addr._id}
                        onChange={() => setAddressId(addr._id)}
                        className="peer sr-only"
                        name="address"
                        type="radio"
                      />
                      <div className="p-md rounded-2xl border-2 border-outline-variant peer-checked:border-primary peer-checked:bg-primary-container/10 transition-all hover:border-primary/50">
                        <div className="flex items-start gap-sm">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${addressId === addr._id ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary'}`}>
                            <span className="material-symbols-outlined">{addr.label === 'Nhà' ? 'home' : addr.label === 'Văn phòng' ? 'work' : 'location_on'}</span>
                          </div>
                          <div>
                            <p className="font-bold">{addr.label}</p>
                            <p className="text-sm text-on-surface-variant leading-snug mt-0.5">{addr.detailAddress}, {addr.ward}</p>
                            <p className="text-[10px] text-on-surface-variant/70 uppercase font-medium mt-1">{addr.district}, {addr.province}</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                  {addresses.length === 0 && (
                    <p className="text-on-surface-variant p-md bg-surface-container-low rounded-2xl border border-dashed border-outline-variant">Bạn chưa có địa chỉ nào. Vui lòng thêm địa chỉ mới.</p>
                  )}
                </div>
              </div>

              {/* Problem Description & Photos */}
              <div className="pt-lg border-t border-outline-variant/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  <div>
                    <label className="block font-bold mb-xs text-on-surface-variant text-sm uppercase tracking-wider">Mô tả tình trạng</label>
                    <textarea
                      className="w-full p-md rounded-2xl border border-outline-variant focus:border-primary outline-none min-h-[140px] text-body-md bg-surface-container-lowest"
                      placeholder="Ghi chú chi tiết về tình trạng hoặc yêu cầu cụ thể..."
                      value={problemDescription || ''}
                      onChange={(e) => setProblemDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-xs text-on-surface-variant text-sm uppercase tracking-wider">Hình ảnh hiện trạng</label>
                    <div className="grid grid-cols-3 gap-sm">
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors group bg-surface-container-lowest">
                        <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">add_a_photo</span>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={() => {
                          alert('Tính năng tải ảnh lên đang được phát triển.');
                          setCustomerAttachments(['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400']);
                        }} />
                      </label>
                      {customerAttachments.map((url, idx) => (
                        <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group shadow-sm border border-outline-variant/30">
                          <img src={url} className="w-full h-full object-cover" alt="Attachment" />
                          <button
                            onClick={() => setCustomerAttachments([])}
                            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-sm italic">* Tải lên tối đa 4 ảnh để chuyên gia dễ dàng hình dung vấn đề.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="bg-white rounded-3xl p-md shadow-sm border border-outline-variant/30">
            <h2 className="font-headline-md text-headline-md text-primary mb-md">Thời gian thực hiện</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-sm mb-lg">
              {[
                { icon: 'bolt', type: 'normal' as const, title: 'Đặt lịch ngay', desc: 'Có mặt sớm nhất' },
                { icon: 'event', type: 'scheduled' as const, title: 'Lên lịch hẹn', desc: 'Chọn giờ cụ thể' },
                { icon: 'update', type: 'recurring' as const, title: 'Đặt định kỳ', desc: 'Lặp lại mỗi tuần' },
              ].map(({ icon, type, title, desc }) => (
                <label key={title} className="cursor-pointer">
                  <input
                    checked={orderType === type}
                    onChange={() => setOrderType(type)}
                    className="peer sr-only"
                    name="booking_type"
                    type="radio"
                  />
                  <div className="p-md rounded-2xl border-2 border-outline-variant peer-checked:border-primary peer-checked:bg-primary-container/5 text-center transition-all h-full flex flex-col items-center">
                    <span className="material-symbols-outlined text-3xl mb-xs">{icon}</span>
                    <p className="font-bold">{title}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md pt-lg border-t border-outline-variant/30">
              <div>
                <p className="font-bold mb-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined">calendar_today</span>
                  Ngày thực hiện
                </p>
                <input
                  type="date"
                  className="w-full p-md rounded-2xl border border-outline-variant focus:border-primary outline-none bg-surface-container-lowest"
                  value={scheduledAt ? scheduledAt.split('T')[0] : ''}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              <div>
                <p className="font-bold mb-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined">schedule</span>
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
                      className={`py-sm rounded-xl transition-colors text-sm font-medium ${scheduledAt?.includes(slot.split(' ')[0])
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
          </section>
        </div>

        <OrderSummaryCard step={2} actionLabel="Tiếp tục bước 3" actionTo="/customer/bookings/new/payment" />
      </div>
    </BookingShell>
  );
};

export default CreateBookingStep2Page;
