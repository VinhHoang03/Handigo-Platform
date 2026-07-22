import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { ReliableImage } from '@/components/common/ReliableImage';
import { Modal } from '@/components/common/Modal';
import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import { useBookingStore } from '../hooks/useBookingStore';
import type { Category, Service, ServiceOption } from '../../../types/booking';
import { groupServiceOptions, isRequiredOptionSelectionMissing } from '../utils/serviceOptionSelection';

const getOptionPrice = (option: ServiceOption): number => option.price ?? option.fixedPrice ?? 0;

const CreateBookingStep1Page = () => {
  const {
    categoryId, setCategoryId, serviceId, setServiceId, toggleOption,
    selectedOptionIds, selectedOptionQuantities, setOptionQuantity,
  } = useBookingStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [selectionError, setSelectionError] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    serviceCatalogApi.categories().then(data => {
      if (!isMounted) return;
      setCategories(data);
      if (data.length > 0 && !categoryId) {
        setCategoryId(data[0]._id);
      }
    });
    return () => { isMounted = false; };
  }, [categoryId, setCategoryId]);

  useEffect(() => {
    let isMounted = true;
    if (categoryId) {
      serviceCatalogApi.servicesByCategory(categoryId).then(data => {
        if (isMounted) setServices(data);
      });
    }
    return () => { isMounted = false; };
  }, [categoryId]);

  useEffect(() => {
    let isMounted = true;
    if (serviceId) {
      serviceCatalogApi.options(serviceId).then(data => {
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
  const selectedService = services.find((service) => service._id === serviceId);
  const isVariablePrice = selectedService?.serviceType === 'variable_price';
  const optionGroups = groupServiceOptions(options);

  const handleSelectCategory = (selectedCategoryId: string) => {
    setCategoryId(selectedCategoryId);
    setIsCategoryModalOpen(false);
    setSelectionError('');
  };

  const continueToLocation = () => {
    if (!selectedService) {
      setSelectionError('Vui lòng chọn một dịch vụ cụ thể.');
      return;
    }
    if (isRequiredOptionSelectionMissing(selectedService, selectedOptionIds)) {
      setSelectionError('Vui lòng chọn ít nhất một tùy chọn dịch vụ.');
      return;
    }
    setSelectionError('');
    navigate('/customer/bookings/new/location');
  };

  return (
    <OrderCreationShell>
      <BookingStepper currentStep={1} />

      <div className="grid grid-cols-12 gap-gutter items-start">
        <div className="col-span-12 lg:col-span-8 space-y-xl">
          <section>
            <h2 className="font-headline-md text-headline-md mb-md flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm">1</span>
              Chọn loại dịch vụ
            </h2>
            <div className="grid grid-cols-6 gap-sm">
              {visibleCategories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => handleSelectCategory(cat._id)}
                  className={`group flex min-h-[104px] flex-col items-center justify-center rounded-xl border-2 bg-surface-container-lowest px-2 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-outline-variant hover:shadow-md ${categoryId === cat._id ? 'border-primary bg-surface-container-low shadow-primary/10' : 'border-outline-variant/30'
                  }`}
                >
                  <div className="mb-2 flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-primary-container/10 transition-colors group-hover:bg-primary-container/20">
                    <CategoryIcon
                      icon={cat.icon}
                      name={cat.name}
                      className="h-6 w-6 text-primary"
                      imageClassName="h-7 w-7 object-contain"
                    />
                  </div>
                  <span className="line-clamp-2 text-label-sm font-bold leading-snug text-on-surface">{cat.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                disabled={categories.length === 0}
                className="group flex min-h-[104px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/60 bg-surface-container-low px-2 py-3 text-center text-on-surface-variant transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-default disabled:opacity-50 disabled:disabled:hover:border-outline-variant/60 disabled:hover:bg-surface-container-low disabled:hover:text-on-surface-variant"
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
              <span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm">2</span>
              Chọn dịch vụ cụ thể
            </h2>
            <div className="space-y-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm">
                {services.map((service) => (
                  <button
                    key={service._id}
                    onClick={() => setServiceId(service._id)}
                    className={`relative text-left overflow-hidden rounded-xl bg-surface-container-lowest border border-outline-variant/30 border-2 cursor-pointer group transition-all hover:border-outline-variant ${serviceId === service._id ? 'border-primary bg-primary-container/5' : 'border-transparent'
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
                  <p className="mb-md font-label-md font-bold text-on-surface">
                    Tùy chọn dịch vụ
                    {selectedService?.requiresOptionSelection ? (
                      <span className="text-error"> *</span>
                    ) : null}
                  </p>
                  <div className="space-y-md">
                    {optionGroups.map((group) => (
                      <fieldset key={group.key}>
                        <legend className="font-label-md mb-sm">
                          {group.label}
                        </legend>
                        <div className="flex flex-wrap gap-sm">
                          {group.options.map((option) => (
                            <label
                              key={option._id}
                              className={`flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full border cursor-pointer hover:border-primary transition-colors ${selectedOptionIds.includes(option._id) ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}
                            >
                              <input
                                className="rounded text-primary focus:ring-primary"
                                type={group.selectionMode === 'single' ? 'radio' : 'checkbox'}
                                name={`option-group-${group.key}`}
                                checked={selectedOptionIds.includes(option._id)}
                                onChange={() => {
                                  setSelectionError('');
                                  toggleOption(option, options);
                                }}
                              />
                              <ReliableImage
                                src={option.image}
                                alt=""
                                aria-hidden="true"
                                className="h-8 w-8 rounded-md object-cover"
                              />
                              <span className="text-label-md">
                                {option.name}
                                {!isVariablePrice && ` (+${getOptionPrice(option).toLocaleString()}đ)`}
                              </span>
                              {option.allowsQuantity && selectedOptionIds.includes(option._id) && (
                                <span className="ml-1 flex items-center gap-1 border-l border-outline-variant pl-2">
                                  <span className="text-xs text-on-surface-variant">SL</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={selectedOptionQuantities?.[option._id] ?? 1}
                                    onChange={(event) => setOptionQuantity(option._id, Number(event.target.value))}
                                    onClick={(event) => event.stopPropagation()}
                                    aria-label={`Số lượng ${option.name}`}
                                    className="w-14 rounded-md border border-outline-variant px-2 py-1 text-center"
                                  />
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </div>
              )}
              {selectionError && <p className="mt-sm text-sm font-semibold text-error">{selectionError}</p>}
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <OrderSummaryCard step={1} actionLabel="Tiếp tục bước 2" onAction={continueToLocation} />
        </div>
      </div>
      <Modal
        open={isCategoryModalOpen}
        title="Chọn loại dịch vụ"
        onClose={() => setIsCategoryModalOpen(false)}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => (
            <button
              key={cat._id}
              type="button"
              onClick={() => handleSelectCategory(cat._id)}
              className={`group flex min-h-[112px] flex-col items-center justify-center rounded-xl border-2 bg-surface-container-lowest px-3 py-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-outline-variant hover:shadow-md ${categoryId === cat._id ? 'border-primary bg-surface-container-low shadow-primary/10' : 'border-outline-variant/30'
                }`}
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary-container/10 transition-colors group-hover:bg-primary-container/20">
                <CategoryIcon
                  icon={cat.icon}
                  name={cat.name}
                  className="h-6 w-6 text-primary"
                  imageClassName="h-7 w-7 object-contain"
                />
              </div>
              <span className="line-clamp-2 text-label-md font-bold leading-snug text-on-surface">{cat.name}</span>
            </button>
          ))}
        </div>
      </Modal>
    </OrderCreationShell>
  );
};

export default CreateBookingStep1Page;

