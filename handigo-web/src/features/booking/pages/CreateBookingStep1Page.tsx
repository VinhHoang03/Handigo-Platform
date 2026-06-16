import { BookingPageHeader, BookingShell, BookingStepper, OrderSummaryCard } from '../components/BookingComponents';
import { servicePackages, serviceTypes } from '../data/bookingMockData';

const addOns = ['Khử khuẩn bếp (+50k)', 'Lau cửa kính tầng cao (+100k)', 'Ủi quần áo (+70k)'];

const CreateBookingStep1Page = () => (
  <BookingShell>
    <BookingPageHeader
      title="Đặt lịch dịch vụ"
      description="Vui lòng hoàn thành các thông tin bên dưới để bắt đầu đặt dịch vụ."
    />
    <BookingStepper currentStep={1} />

    <div className="grid grid-cols-12 gap-gutter items-start">
      <div className="col-span-12 lg:col-span-8 space-y-xl">
        <section>
          <h2 className="font-headline-md text-headline-md mb-md flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">1</span>
            Chọn loại dịch vụ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
            {serviceTypes.map((service, index) => (
              <button
                key={service.id}
                className={`group flex flex-col items-center p-md rounded-xl glass-card transition-all hover:scale-[1.02] border-2 ${
                  index === 0 ? 'border-primary bg-surface-container-low' : 'border-transparent'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center mb-3 group-hover:bg-primary-container/20 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">{service.icon}</span>
                </div>
                <span className="font-label-md">{service.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md mb-md flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">2</span>
            Chọn dịch vụ cụ thể & tùy chọn
          </h2>
          <div className="space-y-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
              {servicePackages.map((service, index) => (
                <button
                  key={service.id}
                  className={`relative text-left p-md rounded-xl glass-card border-2 cursor-pointer group transition-all hover:border-outline-variant ${
                    index === 0 ? 'border-primary bg-primary-container/5' : 'border-transparent'
                  }`}
                >
                  {index === 0 ? (
                    <span className="absolute top-3 right-3 text-primary material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  ) : null}
                  <h3 className="font-label-md mb-1">{service.name}</h3>
                  <p className="text-xs text-on-surface-variant">{service.description}</p>
                  <p className="mt-4 font-bold text-primary">{service.price}</p>
                </button>
              ))}
            </div>

            <div className="mt-md p-md bg-surface-container-low rounded-xl">
              <p className="font-label-md mb-sm">Dịch vụ bổ sung</p>
              <div className="flex flex-wrap gap-sm">
                {addOns.map((addOn) => (
                  <label
                    key={addOn}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-outline-variant cursor-pointer hover:border-primary transition-colors"
                  >
                    <input className="rounded text-primary focus:ring-primary" type="checkbox" />
                    <span className="text-label-md">{addOn}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="col-span-12 lg:col-span-4">
        <OrderSummaryCard step={1} actionLabel="Tiếp tục bước 2" actionTo="/customer/bookings/new/location" />
      </div>
    </div>
  </BookingShell>
);

export default CreateBookingStep1Page;
