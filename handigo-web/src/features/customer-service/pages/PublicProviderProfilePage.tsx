import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { useBookingStore } from "@/features/booking/hooks/useBookingStore";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import {
  customerServiceApi,
  type PublicProviderProfile,
} from "../api/customerService.api";

const formatDate = (value?: string) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("vi-VN");
};

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
          setError("Không tải được hồ sơ chuyên gia. Vui lòng thử lại.");
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

  if (isLoading) {
    return (
      <CustomerServiceLayout>
        <div className="rounded-2xl bg-white p-8 text-center text-on-surface-variant">
          Đang tải hồ sơ chuyên gia...
        </div>
      </CustomerServiceLayout>
    );
  }

  if (error || !profile) {
    return (
      <CustomerServiceLayout>
        <div className="rounded-2xl border border-error/20 bg-error/10 p-8 text-center text-error">
          {error || "Không tìm thấy hồ sơ chuyên gia."}
        </div>
      </CustomerServiceLayout>
    );
  }

  return (
    <CustomerServiceLayout>
      <div className="-mt-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-on-surface shadow-sm hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Quay lại
        </button>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-outline-variant/20 bg-white p-4 text-center shadow-sm sm:flex-row sm:text-left md:p-5">
            <InitialsAvatar
              name={profile.user.fullName}
              src={profile.user.avatar}
              className="h-24 w-24 shrink-0 border border-outline-variant/30 md:h-28 md:w-28"
              textClassName="text-2xl"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="break-words text-2xl font-bold text-on-background md:text-3xl">
                  {profile.user.fullName}
                </h1>
                {profile.provider.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    <span className="material-symbols-outlined text-[14px]">
                      verified
                    </span>
                    Đã xác minh
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric
              label="Đánh giá"
              value={profile.provider.averageRating.toFixed(1)}
              icon="star"
            />
            <Metric
              label="Công việc"
              value={`${profile.provider.totalCompletedOrders}`}
            />
            <Metric
              label="Phản hồi"
              value={`${profile.provider.totalFeedbacks}`}
            />
            <Metric
              label="Kinh nghiệm"
              value={`${profile.provider.experienceYears}+ năm`}
            />
          </section>

          <InfoSection title="Giới thiệu">
            <p>{profile.provider.bio || profile.provider.description}</p>
          </InfoSection>

          {profile.provider.certificates.length > 0 && (
            <InfoSection title="Chứng chỉ">
              {profile.provider.certificates.map((certificate) => (
                <VerificationRow
                  key={certificate.id}
                  icon="workspace_premium"
                  title={certificate.title}
                  description={[
                    certificate.issuer,
                    certificate.issuedAt
                      ? `Cấp ngày ${formatDate(certificate.issuedAt)}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                />
              ))}
            </InfoSection>
          )}

          <section>
            <h2 className="mb-4 text-2xl font-bold text-on-background">
              Khu vực hoạt động
            </h2>
            <div className="mb-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary">
                location_on
              </span>
              Hỗ trợ nhanh tại các khu vực:
            </div>
            <div className="flex flex-wrap gap-2">
              {areas.length ? (
                areas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full border border-outline-variant/30 bg-white px-4 py-2 font-semibold"
                  >
                    {area}
                  </span>
                ))
              ) : (
                <span className="text-on-surface-variant">
                  Chưa cập nhật khu vực hoạt động.
                </span>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-on-background">
                Đánh giá từ khách hàng
              </h2>
              <span className="text-sm font-bold text-primary">
                {profile.provider.totalFeedbacks} đánh giá
              </span>
            </div>
            {profile.feedbacks.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-on-surface-variant">
                Chưa có đánh giá công khai cho chuyên gia này.
              </p>
            ) : (
              profile.feedbacks.map((feedback) => (
                <article
                  key={feedback.id}
                  className="rounded-2xl border border-outline-variant/20 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={feedback.customer.fullName}
                        src={feedback.customer.avatar}
                        className="h-10 w-10"
                        textClassName="text-xs"
                      />
                      <div>
                        <p className="font-bold">
                          {feedback.customer.fullName}
                        </p>
                        <p className="text-xs uppercase text-on-surface-variant">
                          {formatDate(feedback.createdAt)}
                        </p>
                      </div>
                    </div>
                    <RatingStars rating={feedback.rating} />
                  </div>
                  <p className="text-on-surface-variant">{feedback.comment}</p>
                </article>
              ))
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
          <div className="rounded-2xl border border-outline-variant/20 bg-white p-6 shadow-lg">
            <h3 className="text-xl font-bold text-on-background">
              Đặt dịch vụ với chuyên gia này
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Chọn dịch vụ bạn cần. Handigo sẽ giữ đúng chuyên gia này khi họ
              phù hợp với khu vực và lịch đã chọn.
            </p>
            {profile.provider.services.length > 0 ? (
              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Dịch vụ cần đặt
                </span>
                <select
                  value={effectiveSelectedServiceId}
                  onChange={(event) => setSelectedServiceId(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                >
                  {profile.provider.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-5 rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
                Chuyên gia chưa có dịch vụ đang hoạt động để đặt lịch.
              </p>
            )}
            <div className="mt-5 space-y-3">
              <TrustItem icon="verified_user" text="Hồ sơ đã xác minh" />
              <TrustItem
                icon="star"
                text={`${profile.provider.averageRating.toFixed(1)} điểm đánh giá`}
              />
            </div>
            <button
              type="button"
              onClick={handleBookProvider}
              disabled={!effectiveSelectedServiceId}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Đặt lịch với {profile.user.fullName}
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>

          <section className="rounded-2xl border border-outline-variant/20 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-on-background">
              Danh mục dịch vụ
            </h3>
            <div className="mt-4 space-y-2">
              {profile.provider.serviceCategories.map((category) => (
                <div
                  key={category.id}
                  tabIndex={0}
                  className="group rounded-xl border border-outline-variant/30 bg-surface-container-lowest outline-none transition hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10"
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <CategoryIcon
                        icon={category.icon}
                        name={category.name}
                        className="h-5 w-5"
                      />
                    </span>
                    <span className="min-w-0 flex-1 font-bold text-on-surface">
                      {category.name}
                    </span>
                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-hover:rotate-180 group-focus:rotate-180">
                      expand_more
                    </span>
                  </div>
                  <div className="grid grid-rows-[0fr] transition-all duration-200 group-hover:grid-rows-[1fr] group-focus:grid-rows-[1fr]">
                    <div className="overflow-hidden">
                      <ul className="space-y-2 border-t border-outline-variant/20 px-4 py-3">
                        {category.services.map((service) => (
                          <li
                            key={service.id}
                            className="flex items-start gap-2 text-sm text-on-surface-variant"
                          >
                            <span className="material-symbols-outlined mt-0.5 text-[16px] text-primary">
                              check_circle
                            </span>
                            {service.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
              {profile.provider.serviceCategories.length === 0 && (
                <p className="rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
                  Chuyên gia chưa đăng ký danh mục dịch vụ.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
      </div>
    </CustomerServiceLayout>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-white p-5 text-center shadow-sm">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
        {value}
        {icon && (
          <span
            className="material-symbols-outlined text-star-gold"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-bold text-on-background">{title}</h2>
      <div className="space-y-3 leading-7 text-on-surface-variant">
        {children}
      </div>
    </section>
  );
}

function VerificationRow({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface-container-low p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="font-bold text-on-background">{title}</p>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex text-star-gold">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className="material-symbols-outlined text-sm"
          style={{
            fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          star
        </span>
      ))}
    </div>
  );
}

function TrustItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-primary-container/5 p-3">
      <span className="material-symbols-outlined text-primary">{icon}</span>
      <span className="text-sm font-semibold">{text}</span>
    </div>
  );
}
