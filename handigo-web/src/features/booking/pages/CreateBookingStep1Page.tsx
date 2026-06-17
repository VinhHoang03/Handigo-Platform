import { useEffect, useState } from 'react';
import { BookingPageHeader, BookingShell, BookingStepper, OrderSummaryCard } from '../components/BookingComponents';
import { bookingApi } from '../../../api/booking';
import { useBookingStore } from '../hooks/useBookingStore';
import type { Category, Service, ServiceOption } from '../../../types/booking';

const CreateBookingStep1Page = () => {
  const { categoryId, setCategoryId, serviceId, setServiceId, toggleOption, selectedOptionIds } = useBookingStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);

  useEffect(() => {
    let isMounted = true;
    bookingApi.getCategories().then(data => {
      if (!isMounted) return;
      setCategories(data);
      if (data.length > 0 && !categoryId) {
        setCategoryId(data[0]._id);
      }
    });
    return () => { isMounted = false; };
  }, [categoryId, setCategoryId]);

  useEffect(() => {
    if (categoryId) {
      bookingApi.getServices(categoryId).then(setServices);
    }
  }, [categoryId]);

  useEffect(() => {
    let isMounted = true;
    if (serviceId) {
      bookingApi.getOptions(serviceId).then(data => {
        if (isMounted) setOptions(data);
      });
    } else {
      setTimeout(() => {
        if (isMounted) setOptions([]);
      }, 0);
    }
    return () => { isMounted = false; };
  }, [serviceId]);

  return (
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
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setCategoryId(cat._id)}
                  className={`group flex flex-col items-center p-md rounded-xl glass-card transition-all hover:scale-[1.02] border-2 ${categoryId === cat._id ? 'border-primary bg-surface-container-low' : 'border-transparent'
                    }`}
                >
                  <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center mb-3 group-hover:bg-primary-container/20 transition-colors">
                    <span className="material-symbols-outlined text-primary text-3xl">{cat.icon || 'category'}</span>
                  </div>
                  <span className="font-label-md">{cat.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-headline-md text-headline-md mb-md flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">2</span>
              Chọn dịch vụ cụ thể
            </h2>
            <div className="space-y-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
                {services.map((service) => (
                  <button
                    key={service._id}
                    onClick={() => setServiceId(service._id)}
                    className={`relative text-left p-md rounded-xl glass-card border-2 cursor-pointer group transition-all hover:border-outline-variant ${serviceId === service._id ? 'border-primary bg-primary-container/5' : 'border-transparent'
                      }`}
                  >
                    {serviceId === service._id ? (
                      <span className="absolute top-3 right-3 text-primary material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    ) : null}
                    <h3 className="font-label-md mb-1">{service.name}</h3>
                    <p className="text-xs text-on-surface-variant line-clamp-2">{service.description}</p>
                    <p className="mt-4 font-bold text-primary">
                      {service.fixedPrice
                        ? `${service.fixedPrice.toLocaleString()}đ`
                        : service.serviceType === 'variable_price'
                          ? `Phí dịch vụ: ${service.depositAmount?.toLocaleString() || 0}đ`
                          : '0đ'}
                    </p>
                  </button>
                ))}
              </div>

              {options.length > 0 && (
                <div className="mt-md p-md bg-surface-container-low rounded-xl">
                  <p className="font-label-md mb-sm">Dịch vụ bổ sung</p>
                  <div className="flex flex-wrap gap-sm">
                    {options.map((option) => (
                      <label
                        key={option._id}
                        className={`flex items-center gap-2 px-4 py-2 bg-white rounded-full border cursor-pointer hover:border-primary transition-colors ${selectedOptionIds.includes(option._id) ? 'border-primary bg-primary/5' : 'border-outline-variant'
                          }`}
                      >
                        <input
                          className="rounded text-primary focus:ring-primary"
                          type="checkbox"
                          checked={selectedOptionIds.includes(option._id)}
                          onChange={() => toggleOption(option._id)}
                        />
                        <span className="text-label-md">{option.name} (+{option.fixedPrice.toLocaleString()}đ)</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <OrderSummaryCard step={1} actionLabel="Tiếp tục bước 2" actionTo="/customer/bookings/new/location" />
        </div>
      </div>
    </BookingShell>
  );
};

export default CreateBookingStep1Page;
