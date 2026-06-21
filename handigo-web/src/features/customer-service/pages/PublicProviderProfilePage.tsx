import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import {
  customerServiceApi,
  type PublicProviderProfile,
} from "../api/customerService.api";

const coverImage =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80";

const portfolioImages = [
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80",
];

const getAvatar = (profile: PublicProviderProfile) =>
  profile.user.avatar ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.user.fullName)}&background=E2DFFF&color=0F006D`;

const getCustomerAvatar = (name: string, avatar?: string | null) =>
  avatar ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=F2F3FF&color=131B2E`;

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
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-on-surface shadow-sm hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Quay lại
        </button>
        <div className="flex gap-2">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white text-on-surface shadow-sm hover:bg-surface-container-low">
            <span className="material-symbols-outlined">favorite</span>
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white text-on-surface shadow-sm hover:bg-surface-container-low">
            <span className="material-symbols-outlined">share</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <section className="relative">
            <div className="h-64 overflow-hidden rounded-2xl shadow-sm md:h-80">
              <img
                src={coverImage}
                alt="Không gian dịch vụ chuyên nghiệp"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="relative -mt-16 flex flex-col gap-5 px-5 md:flex-row md:items-end">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg md:h-40 md:w-40">
                <img
                  src={getAvatar(profile)}
                  alt={profile.user.fullName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold text-on-background md:text-4xl">
                    {profile.user.fullName}
                  </h1>
                  {profile.provider.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      Đã xác minh
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-xl text-on-surface-variant">
                  {profile.provider.mainServiceText ||
                    profile.provider.bio ||
                    profile.provider.description}
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric label="Đánh giá" value={profile.provider.averageRating.toFixed(1)} icon="star" />
            <Metric label="Công việc" value={`${profile.provider.totalCompletedOrders}`} />
            <Metric label="Phản hồi" value={`${profile.provider.totalFeedbacks}`} />
            <Metric label="Kinh nghiệm" value={`${profile.provider.experienceYears}+ năm`} />
          </section>

          <InfoSection title="Giới thiệu">
            <p>{profile.provider.bio || profile.provider.description}</p>
          </InfoSection>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-on-background">
              Dịch vụ cung cấp
            </h2>
            <div className="flex flex-wrap gap-3">
              {profile.provider.services.map((service) => (
                <span
                  key={service.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-white px-4 py-3 font-semibold"
                >
                  <span className="material-symbols-outlined text-primary">home_repair_service</span>
                  {service.name}
                </span>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-on-background">
                Dự án đã thực hiện
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {portfolioImages.map((image) => (
                <img
                  key={image}
                  src={image}
                  alt="Dự án đã thực hiện"
                  className="aspect-square rounded-xl object-cover shadow-sm"
                />
              ))}
              <div className="grid aspect-square place-items-center rounded-xl bg-surface-container-high font-bold text-on-surface-variant">
                +{Math.max(profile.provider.totalCompletedOrders - 5, 0)} ảnh khác
              </div>
            </div>
          </section>

          <InfoSection title="Chứng chỉ & xác minh">
            <VerificationRow
              icon="badge"
              title="Định danh cá nhân"
              description={
                profile.provider.identityVerified
                  ? "Thông tin định danh đã được hệ thống Handigo kiểm duyệt."
                  : "Thông tin định danh đang được cập nhật."
              }
            />
            {profile.provider.certificates.length === 0 ? (
              <VerificationRow
                icon="workspace_premium"
                title="Chứng chỉ nghề nghiệp"
                description="Chuyên gia chưa công khai chứng chỉ nghề nghiệp."
              />
            ) : (
              profile.provider.certificates.map((certificate) => (
                <VerificationRow
                  key={certificate.id}
                  icon="workspace_premium"
                  title={certificate.title}
                  description={[
                    certificate.issuer,
                    certificate.issuedAt ? `Cấp ngày ${formatDate(certificate.issuedAt)}` : "",
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                />
              ))
            )}
          </InfoSection>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-on-background">
              Khu vực hoạt động
            </h2>
            <div className="mb-4 flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary">location_on</span>
              Hỗ trợ nhanh tại các khu vực:
            </div>
            <div className="flex flex-wrap gap-2">
              {areas.length ? (
                areas.map((area) => (
                  <span key={area} className="rounded-full border border-outline-variant/30 bg-white px-4 py-2 font-semibold">
                    {area}
                  </span>
                ))
              ) : (
                <span className="text-on-surface-variant">Chưa cập nhật khu vực hoạt động.</span>
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
                      <img
                        src={getCustomerAvatar(feedback.customer.fullName, feedback.customer.avatar)}
                        alt={feedback.customer.fullName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-bold">{feedback.customer.fullName}</p>
                        <p className="text-xs uppercase text-on-surface-variant">
                          {formatDate(feedback.createdAt)}
                        </p>
                      </div>
                    </div>
                    <RatingStars rating={feedback.rating} />
                  </div>
                  <p className="text-on-surface-variant">
                    {feedback.comment || "Khách hàng không để lại bình luận."}
                  </p>
                </article>
              ))
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:col-span-4">
          <div className="rounded-2xl border border-outline-variant/20 bg-white p-6 shadow-lg">
            <h3 className="text-xl font-bold text-on-background">
              Đặt dịch vụ với chuyên gia này
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Chọn dịch vụ phù hợp từ hồ sơ chuyên gia, sau đó Handigo sẽ điều phối theo khu vực và lịch trống.
            </p>
            <div className="mt-5 space-y-3">
              <TrustItem icon="verified_user" text="Hồ sơ đã xác minh" />
              <TrustItem icon="security" text="Thanh toán an toàn" />
              <TrustItem icon="star" text={`${profile.provider.averageRating.toFixed(1)} điểm đánh giá`} />
            </div>
            <Link
              to="/customer/services"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-md hover:opacity-90"
            >
              Xem dịch vụ phù hợp
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </aside>
      </div>
    </CustomerServiceLayout>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-white p-5 text-center shadow-sm">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
        {value}
        {icon && (
          <span className="material-symbols-outlined text-star-gold" style={{ fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-bold text-on-background">{title}</h2>
      <div className="space-y-3 leading-7 text-on-surface-variant">{children}</div>
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
          style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
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
