import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBookingStore } from "@/features/booking/hooks/useBookingStore";
import { AsyncState } from "@/components/common/AsyncState";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import { ProviderProfileSkeleton } from "../components/ProviderProfileSkeleton";
import { ProviderProfileHeader } from "../components/ProviderProfileHeader";
import { ProviderAboutSection } from "../components/ProviderAboutSection";
import { ProviderServiceAreas } from "../components/ProviderServiceAreas";
import { ProviderFeedbackSection } from "../components/ProviderFeedbackSection";
import { ProviderBookingPanel } from "../components/ProviderBookingPanel";
import { ProviderCategoriesPanel } from "../components/ProviderCategoriesPanel";
import {
  customerServiceApi,
  type PublicProviderProfile,
} from "../api/customerService.api";

const getAreaText = (profile: PublicProviderProfile) => {
  const serviceArea = [
    profile.provider.serviceArea?.ward,
    profile.provider.serviceArea?.province,
  ]
    .filter(Boolean)
    .join(", ");

  if (profile.provider.workingAreas.length) {
    return profile.provider.workingAreas;
  }

  return serviceArea ? [serviceArea] : [];
};

export default function PublicProviderProfilePage() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProviderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const selectService = useBookingStore((state) => state.selectService);
  const setPreferredProviderId = useBookingStore(
    (state) => state.setPreferredProviderId,
  );
  const setRequestedProvider = useBookingStore(
    (state) => state.setRequestedProvider,
  );

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!providerId) return;
      setIsLoading(true);
      setError("");
      try {
        const data = await customerServiceApi.publicProviderProfile(providerId);
        if (isMounted) setProfile(data);
      } catch {
        if (isMounted) {
          setError("Không tải được hồ sơ thợ. Vui lòng thử lại.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [providerId]);

  const areas = useMemo(() => (profile ? getAreaText(profile) : []), [profile]);
  const effectiveSelectedServiceId = profile?.provider.services.some(
    (service) => service.id === selectedServiceId,
  )
    ? selectedServiceId
    : (profile?.provider.services[0]?.id ?? "");

  const handleBookProvider = () => {
    if (!profile) return;

    const selectedService = profile.provider.services.find(
      (service) => service.id === effectiveSelectedServiceId,
    );
    if (!selectedService?.categoryId) return;

    selectService(selectedService.categoryId, selectedService.id);
    setRequestedProvider(profile.provider.id, profile.user.fullName);
    setPreferredProviderId(profile.provider.id, profile.user.fullName);
    navigate("/customer/bookings/new/location", {
      state: { fromProviderProfile: true },
    });
  };

  return (
    <CustomerServiceLayout>
      <div className="-mt-4">
        <AsyncState loading={isLoading} skeleton={<ProviderProfileSkeleton />}>
          {error || !profile ? (
            <div className="rounded-2xl border border-error/20 bg-error/10 p-8 text-center text-error">
              {error || "Không tìm thấy hồ sơ thợ."}
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-1.5 text-sm font-semibold text-on-surface shadow-sm hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    arrow_back
                  </span>
                  Quay lại
                </button>
              </div>

              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                <div className="space-y-10 lg:col-span-8">
                  <ProviderProfileHeader profile={profile} />

                  <ProviderAboutSection
                    bio={profile.provider.bio}
                    description={profile.provider.description}
                    certificates={profile.provider.certificates}
                  />

                  <ProviderServiceAreas areas={areas} />

                  <ProviderFeedbackSection
                    feedbacks={profile.feedbacks}
                    totalFeedbacks={profile.provider.totalFeedbacks}
                  />
                </div>

                <aside className="space-y-4 lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
                  <ProviderBookingPanel
                    providerFullName={profile.user.fullName}
                    averageRating={profile.provider.averageRating}
                    services={profile.provider.services}
                    selectedServiceId={effectiveSelectedServiceId}
                    onSelectService={setSelectedServiceId}
                    onBook={handleBookProvider}
                  />

                  <ProviderCategoriesPanel
                    categories={profile.provider.serviceCategories}
                  />
                </aside>
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </CustomerServiceLayout>
  );
}
