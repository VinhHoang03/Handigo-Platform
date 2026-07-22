import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { CategoryQuickSelect } from '../components/CategoryQuickSelect';
import { CategoryPickerModal } from '../components/CategoryPickerModal';
import { ServiceGrid } from '../components/ServiceGrid';
import { ServiceOptionsPanel } from '../components/ServiceOptionsPanel';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import { useBookingStore } from '../hooks/useBookingStore';
import type { Category, Service, ServiceOption } from '../../../types/booking';
import { groupServiceOptions, isRequiredOptionSelectionMissing } from '../utils/serviceOptionSelection';

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
            <CategoryQuickSelect
              categories={visibleCategories}
              categoryId={categoryId}
              onSelect={handleSelectCategory}
              onOpenMore={() => setIsCategoryModalOpen(true)}
            />
          </section>

          <section>
            <h2 className="font-headline-md text-headline-md mb-md flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm">2</span>
              Chọn dịch vụ cụ thể
            </h2>
            <div className="space-y-md">
              <ServiceGrid services={services} serviceId={serviceId} onSelect={setServiceId} />

              {options.length > 0 && (
                <ServiceOptionsPanel
                  optionGroups={optionGroups}
                  selectedOptionIds={selectedOptionIds}
                  selectedOptionQuantities={selectedOptionQuantities}
                  isVariablePrice={isVariablePrice}
                  requiresOptionSelection={selectedService?.requiresOptionSelection}
                  onToggleOption={(option) => {
                    setSelectionError('');
                    toggleOption(option, options);
                  }}
                  onQuantityChange={setOptionQuantity}
                />
              )}
              {selectionError && <p className="mt-sm text-sm font-semibold text-error">{selectionError}</p>}
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <OrderSummaryCard step={1} actionLabel="Tiếp tục bước 2" onAction={continueToLocation} />
        </div>
      </div>

      <CategoryPickerModal
        open={isCategoryModalOpen}
        categories={categories}
        categoryId={categoryId}
        onSelect={handleSelectCategory}
        onClose={() => setIsCategoryModalOpen(false)}
      />
    </OrderCreationShell>
  );
};

export default CreateBookingStep1Page;
