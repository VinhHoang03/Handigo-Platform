import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useBookingStore } from "@/features/booking/hooks/useBookingStore";
import type { ServiceOption } from "@/types/booking";
import { AsyncState } from "@/components/common/AsyncState";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import { NearbyProviderSelector } from "../components/NearbyProviderSelector";
import type { ProviderAvailabilityStatus } from "../components/NearbyProviderSelector";
import { ServiceDetailSkeleton } from "../components/ServiceDetailSkeleton";
import { ServiceGallery } from "../components/ServiceGallery";
import { ServiceDescriptionSection } from "../components/ServiceDescriptionSection";
import { ServiceOptionsSection } from "../components/ServiceOptionsSection";
import { ServiceChecklistSection } from "../components/ServiceChecklistSection";
import { RelatedServicesSection } from "../components/RelatedServicesSection";
import { BookingSidebar } from "../components/BookingSidebar";
import { CurrentLocationModal } from "../components/CurrentLocationModal";
import { useServiceDetailData } from "../components/useServiceDetailData";
import { useServicePricing } from "../components/useServicePricing";
import { useAddressSelection } from "../components/useAddressSelection";
import { useBookNowHandler } from "../components/useBookNowHandler";
import { getCategoryName } from "../utils/serviceDisplay";
import {
  groupServiceOptions,
  toggleServiceOption,
} from "@/features/booking/utils/serviceOptionSelection";

export default function CustomerServiceDetailPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { addressId, selectService, setAddressId } = useBookingStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthInitializing = useAuthStore((state) => state.isInitializing);

  const { service, categories, options, relatedServices, isLoading, error } =
    useServiceDetailData(serviceId);

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [selectedOptionQuantities, setSelectedOptionQuantities] = useState<
    Record<string, number>
  >({});
  const [optionSelectionError, setOptionSelectionError] = useState("");
  const [providerAvailability, setProviderAvailability] =
    useState<ProviderAvailabilityStatus>("idle");

  const { estimatePrice } = useServicePricing(
    service,
    options,
    selectedOptionIds,
    selectedOptionQuantities,
  );

  const {
    addresses,
    isLoadingAddresses,
    addressSelectionError,
    setAddressSelectionError,
    requiresPhoneUpdate,
    handleAddressChange,
    isLocating,
    currentLocationDraft,
    currentLocationError,
    isResolvingCurrentAddress,
    isSavingCurrentLocation,
    handlePositionChange,
    handleConfirm,
    closeDraft,
  } = useAddressSelection({
    service,
    addressId,
    setAddressId,
    isAuthenticated,
    isAuthInitializing,
    navigate,
    onAddressChanged: () => setProviderAvailability("idle"),
  });

  const optionGroups = groupServiceOptions(options);

  const handleToggleOption = (option: ServiceOption) => {
    setOptionSelectionError("");
    setSelectedOptionIds((current) => toggleServiceOption(current, option, options));
    setSelectedOptionQuantities((current) => ({
      ...current,
      [option._id]: current[option._id] ?? 1,
    }));
  };

  const handleBookNow = useBookNowHandler({
    service,
    isAuthenticated,
    navigate,
    addressId,
    addresses,
    providerAvailability,
    selectedOptionIds,
    selectedOptionQuantities,
    setAddressSelectionError,
    setOptionSelectionError,
    selectService,
  });

  return (
    <CustomerServiceLayout>
      <AsyncState loading={isLoading} skeleton={<ServiceDetailSkeleton />}>
        {error || !service ? (
          <div className="rounded-xl border border-error/20 bg-error/10 p-8 text-center text-error">
            {error || "Không tìm thấy dịch vụ."}
          </div>
        ) : (
          <>
            <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
              <Link to="/customer" className="hover:text-primary">
                Trang chủ
              </Link>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <Link to="/customer/services" className="hover:text-primary">
                Dịch vụ
              </Link>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span className="font-semibold text-on-surface">{service.name}</span>
            </nav>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-8 lg:col-span-8">
                <ServiceGallery
                  service={service}
                  categoryName={getCategoryName(service, categories)}
                />
                <ServiceDescriptionSection service={service} />
                <ServiceOptionsSection
                  service={service}
                  options={options}
                  optionGroups={optionGroups}
                  selectedOptionIds={selectedOptionIds}
                  selectedOptionQuantities={selectedOptionQuantities}
                  optionSelectionError={optionSelectionError}
                  onToggleOption={handleToggleOption}
                  onQuantityChange={(optionId, quantity) =>
                    setSelectedOptionQuantities((current) => ({
                      ...current,
                      [optionId]: quantity,
                    }))
                  }
                />
                <ServiceChecklistSection />
                <RelatedServicesSection relatedServices={relatedServices} />
              </div>

              <aside className="space-y-5 lg:sticky lg:top-28 lg:col-span-4">
                <BookingSidebar
                  service={service}
                  estimatePrice={estimatePrice}
                  addresses={addresses}
                  addressId={addressId}
                  isLoadingAddresses={isLoadingAddresses}
                  isLocating={isLocating}
                  addressSelectionError={addressSelectionError}
                  requiresPhoneUpdate={requiresPhoneUpdate}
                  onAddressChange={handleAddressChange}
                  isBookDisabled={
                    isAuthenticated &&
                    addresses.some((address) => address._id === addressId) &&
                    providerAvailability !== "available"
                  }
                  onBookNow={handleBookNow}
                />

                <NearbyProviderSelector
                  serviceId={service._id}
                  addressId={addressId}
                  enabled={
                    !isLoadingAddresses &&
                    addresses.some((address) => address._id === addressId)
                  }
                  allowSelection={false}
                  onAvailabilityChange={setProviderAvailability}
                />
              </aside>
            </div>

            <CurrentLocationModal
              draft={currentLocationDraft}
              isSaving={isSavingCurrentLocation}
              isResolving={isResolvingCurrentAddress}
              error={currentLocationError}
              onClose={closeDraft}
              onPositionChange={handlePositionChange}
              onConfirm={() => void handleConfirm()}
            />
          </>
        )}
      </AsyncState>
    </CustomerServiceLayout>
  );
}
