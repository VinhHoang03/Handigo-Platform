import { BookingPageHeader, BookingShell, BookingStepper, OrderSummaryCard } from '../components/BookingComponents';
import { mapImage } from '../data/bookingMockData';

const timeSlots = ['08:00 - 10:00', '10:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00'];

const CreateBookingStep2Page = () => (
  <BookingShell>
    <BookingPageHeader
      title="Thời gian & địa điểm"
      description="Chọn địa chỉ thực hiện, loại hình đặt lịch và khung giờ phù hợp."
    />
    <BookingStepper currentStep={2} />

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
      <div className="lg:col-span-2 space-y-lg">
        <section className="bg-white rounded-3xl p-md shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between gap-md mb-md">
            <h2 className="font-headline-md text-headline-md text-primary">Địa điểm thực hiện</h2>
            <button className="text-primary font-label-md hover:underline flex items-center gap-xs">
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Thêm địa chỉ mới
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div className="space-y-sm">
              {[
                ['home', 'Nhà riêng', '123 Đường Nguyễn Huệ, Quận 1, TP.HCM'],
                ['work', 'Văn phòng', 'Bitexco Financial Tower, Quận 1, TP.HCM'],
              ].map(([icon, label, address], index) => (
                <label key={label} className="group relative block cursor-pointer">
                  <input defaultChecked={index === 0} className="peer sr-only" name="address" type="radio" />
                  <div className="p-sm rounded-2xl border-2 border-outline-variant peer-checked:border-primary peer-checked:bg-primary-container/5 transition-all">
                    <div className="flex items-start gap-sm">
                      <span className="material-symbols-outlined text-primary">{icon}</span>
                      <div>
                        <p className="font-bold">{label}</p>
                        <p className="text-sm text-on-surface-variant">{address}</p>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="rounded-2xl overflow-hidden relative min-h-[160px] border border-outline-variant">
              <img className="w-full h-full object-cover" src={mapImage} alt="Bản đồ địa điểm thực hiện" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 bg-primary rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-bounce">
                  <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    location_on
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-md shadow-sm border border-outline-variant/30">
          <h2 className="font-headline-md text-headline-md text-primary mb-md">Loại hình đặt lịch</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-sm mb-lg">
            {[
              ['bolt', 'Đặt lịch ngay', 'Dịch vụ sớm nhất có thể'],
              ['event', 'Lên lịch hẹn', 'Chọn thời gian cụ thể'],
              ['update', 'Đặt định kỳ', 'Lặp lại hằng tuần/tháng'],
            ].map(([icon, title, desc], index) => (
              <label key={title} className="cursor-pointer">
                <input defaultChecked={index === 1} className="peer sr-only" name="booking_type" type="radio" />
                <div className="p-md rounded-2xl border-2 border-outline-variant peer-checked:border-primary peer-checked:bg-primary-container/5 text-center transition-all h-full flex flex-col items-center">
                  <span className="material-symbols-outlined text-3xl mb-xs">{icon}</span>
                  <p className="font-bold">{title}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <p className="font-bold mb-sm flex items-center gap-xs">
                <span className="material-symbols-outlined">calendar_today</span>
                Chọn ngày thực hiện
              </p>
              <div className="bg-surface-container-low p-sm rounded-2xl">
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold mb-xs">
                  {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {[28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((day, index) =>
                    index < 3 ? (
                      <div key={`${day}-${index}`} className="p-xs text-on-surface-variant opacity-30">
                        {day}
                      </div>
                    ) : (
                      <button key={`${day}-${index}`} className={`p-xs rounded-lg ${day === 6 ? 'bg-primary text-white shadow-md' : 'hover:bg-primary-container/20'}`}>
                        {day}
                      </button>
                    ),
                  )}
                </div>
              </div>
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
                    className={`py-sm rounded-xl transition-colors text-sm font-medium ${
                      slot === '14:00 - 16:00'
                        ? 'border border-primary bg-primary-container/5 text-primary font-bold'
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

export default CreateBookingStep2Page;
