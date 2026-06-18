import { useEffect, useState } from 'react';
import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { bookingApi } from '../../../api/booking';
import { useBookingStore } from '../hooks/useBookingStore';
import type { Category, Service, ServiceOption } from '../../../types/booking';

const isImageUrl = (value?: string) => {
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith('/');
};

const getOptionPrice = (option: ServiceOption): number => option.price ?? option.fixedPrice ?? 0;

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

  const visibleCategories = categories.slice(0, 5);
  const hasMoreCategories = categories.length > visibleCategories.length;

  return (
    <OrderCreationShell>
      <BookingStepper currentStep={1} />

      <div className="grid grid-cols-12 gap-gutter items-start">
        <div className="col-span-12 lg:col-span-8 space-y-xl">
          <section>
            <h2 className="font-headline-md text-headline-md mb-md flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">1</span>
              Chọn loại dịch vụ
            </h2>
            <div className="grid grid-cols-6 gap-sm">
              {visibleCategories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setCategoryId(cat._id)}
                  className={`group flex min-h-[104px] flex-col items-center justify-center rounded-xl border-2 bg-white px-2 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-outline-variant hover:shadow-md ${categoryId === cat._id ? 'border-primary bg-surface-container-low shadow-primary/10' : 'border-outline-variant/30'
                    }`}
                >
                  <div className="mb-2 flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-primary-container/10 transition-colors group-hover:bg-primary-container/20">
                    {isImageUrl(cat.icon) ? (
                      <img
                        src={cat.icon}
                        alt={cat.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-2xl">{cat.icon || 'category'}</span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-label-sm font-bold leading-snug text-on-surface">{cat.name}</span>
                </button>
              ))}
              <button
                type="button"
                disabled={!hasMoreCategories}
                className="group flex min-h-[104px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/60 bg-surface-container-low px-2 py-3 text-center text-on-surface-variant transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-default disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-outline-variant/60 disabled:hover:bg-surface-container-low disabled:hover:text-on-surface-variant"
              >
                <span className="material-symbols-outlined mb-2 text-3xl transition-transform group-hover:translate-x-0.5">
                  arrow_forward
                </span>
                <span className="text-label-sm font-bold">Thêm</span>
              </button>
            </div>
          </section>

          <section>
            <h2 className="font-headline-md text-headline-md mb-md flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">2</span>
              Chọn dịch vụ cụ thể
            </h2>
            <div className="space-y-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm">
                {services.map((service) => (
                  <button
                    key={service._id}
                    onClick={() => setServiceId(service._id)}
                    className={`relative text-left overflow-hidden rounded-xl glass-card border-2 cursor-pointer group transition-all hover:border-outline-variant ${serviceId === service._id ? 'border-primary bg-primary-container/5' : 'border-transparent'
                      }`}
                  >
                    {serviceId === service._id ? (
                      <span className="absolute top-3 right-3 z-10 text-primary material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    ) : null}
                    <div className="aspect-[5/3] w-full overflow-hidden bg-surface-container-low">
                      {service.image ? (
                        <img
                          src={service.image}
                          alt={service.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-4xl">home_repair_service</span>
                        </div>
                      )}
                    </div>
                    <div className="p-sm">
                      <h3 className="font-label-md mb-1 pr-8 leading-snug line-clamp-1">{service.name}</h3>
                      <p className="text-xs text-on-surface-variant line-clamp-2 leading-snug">{service.description}</p>
                    </div>
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
                        <span className="text-label-md">{option.name} (+{getOptionPrice(option).toLocaleString()}đ)</span>
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
    </OrderCreationShell>
  );
};

export default CreateBookingStep1Page;

