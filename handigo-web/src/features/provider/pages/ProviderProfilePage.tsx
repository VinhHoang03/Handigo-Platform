import React from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import {
  BankAccountPanel,
  DangerZone,
  InfoField,
  PerformanceStats,
  PortfolioGrid,
  ProfileSection,
  ProviderHero,
  ServiceAreaPanel,
  SettingsMenu,
  SkillTags,
  VerificationPanel,
} from "../components/ProviderProfileComponents";
import { useProviderAvailability } from "../hooks/useProviderAvailability";
import type {
  BankAccount,
  PerformanceStat,
  PortfolioItem,
  ProviderProfile,
  ServiceArea,
  VerificationItem,
} from "../types/provider.types";

const PROFILE_AVATAR =
  "https://lh3.googleusercontent.com/aida/AP1WRLupP6uxAR-x7hxH7me1b6esrA6X6Sa9J5ZmWN0Ou7UtxMUbHiwrbNINZgKKXWiezZwstySxeQCaA9PONBAmXo-faVHqt8ZIQiLFqyK5hQ7II0vfbS8YMzcNUPdvTixkP1Kr-XP5ZYSqMDNlhxJNqTy_0s7RTjhtOUFsC2-nDI3-PDn9-NfUccmGLYRAFBUwHFsyTefoubnD_sorxrJyIAOjbwYXEmS0f9BYS6cz2_8Anl7y5Yk64O96ncY";
const WORK_IMAGE =
  "https://lh3.googleusercontent.com/aida/AP1WRLta08NUukFb4jJFGe13lMbQI-yiMaV_VlEkyxbKmn1TVIuNC5k0GvwthQkSzaxCy9aPDUKuXtSte_Gr-7rwFJf8TgoLuX_brrAcyGuFASN9qZM6Z1EJJj7JJcXE3F6aTc6Wcg7vH0j_lQsobReGs9MzPuO5Q9ZOlhEHnt17QWHnbRCFBy9P9_LAAKYh5yTdIgSe4h_kYZG345_Jkg2Rjm5Kc2NWj3IvwspSqAnSEjWeaAhvAHwPGkGbGg";
const MAP_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCcxxkZX0EAxdKt72b3lfZ9eyg1chkA5LKSQJ6IsWEQXzkluhUtv9SDgCgG10YikTzZWLCujGay7i7vOZU_A2ipXS41Lnt47xS2IzJWG21UBVkCdGbgCIljpIvqtRFPm33NtklnlvCc--lOUyjJpSdYoCf4auMmo-tQPo1_-En0n6ggpBYUwM68D_BApV7knX-YyW7kLRQOHQ-tIaUaoTEW_DGcPaKoGgGTVYt3RKByixQfFYRtsJQsCcFhJpybmns6CEGFBpsqgzQ";

const providerProfile: ProviderProfile = {
  fullName: "Nguyễn Văn An",
  email: "an.nguyen@fixnow.com",
  phone: "+84 987 654 321",
  city: "TP. Hồ Chí Minh",
  address: "Phường Thảo Điền, Quận 2, TP. Hồ Chí Minh",
  gender: "Nam",
  birthday: "15/05/1992",
  bio: "Tôi là thợ điện lạnh chuyên nghiệp với hơn 5 năm kinh nghiệm. Luôn đặt chữ Tín và sự hài lòng của khách hàng lên hàng đầu. Sẵn sàng phục vụ nhanh chóng, minh bạch về giá cả và bảo hành chu đáo cho mọi công việc sửa chữa.",
  mainService: "Sửa chữa điện lạnh",
  experience:
    "5 năm kinh nghiệm thực tế tại các dự án dân dụng và doanh nghiệp.",
  skills: [
    "Máy lạnh (Inverter)",
    "Tủ lạnh (Side-by-side)",
    "Máy giặt lồng ngang",
    "Lắp đặt hệ thống VRV",
  ],
  certifications: [
    {
      id: "1",
      title: "Chứng chỉ kỹ thuật điện lạnh dân dụng",
      expiryDate: "10/2026",
    },
  ],
  rating: 4.9,
  reviewCount: 120,
  totalBookings: 150,
  providerCode: "PRO-8899",
  isVerified: true,
  joinDate: "2021",
  avatarUrl: PROFILE_AVATAR,
};

const performanceStats: PerformanceStat[] = [
  { label: "Đánh giá trung bình", value: "4.92", meta: "+0.1%" },
  { label: "Đơn hàng hoàn tất", value: "158", meta: "+12" },
  { label: "Tỷ lệ hoàn thành", value: "98.5%", meta: "Tốt" },
  { label: "Tốc độ phản hồi", value: "15 min", meta: "Nhanh", tone: "warning" },
];

const portfolioItems: PortfolioItem[] = [
  { id: "1", alt: "Sửa chữa vòi nước", imageUrl: WORK_IMAGE },
  { id: "2", alt: "Vệ sinh máy lạnh", imageUrl: WORK_IMAGE },
  { id: "3", alt: "Lắp đặt bảng điện", imageUrl: WORK_IMAGE },
];

const verificationItems: VerificationItem[] = [
  { label: "Số điện thoại", status: "Đã xác minh", statusTone: "approved" },
  { label: "Địa chỉ Email", status: "Đã xác minh", statusTone: "approved" },
  { label: "CCCD/Hộ chiếu", status: "Đã phê duyệt", statusTone: "approved" },
  {
    label: "Tài khoản ngân hàng",
    status: "Đang kiểm tra",
    statusTone: "pending",
  },
];

const serviceArea: ServiceArea = {
  address: providerProfile.address,
  radiusKm: 15,
  radiusPercent: 75,
  mapImageUrl: MAP_IMAGE,
};

const bankAccount: BankAccount = {
  shortName: "VCB",
  bankName: "Vietcombank",
  maskedNumber: "**** **** 8899",
};

const ProviderProfilePage: React.FC = () => {
  const { isOnline, toggleAvailability } = useProviderAvailability();

  return (
    <DashboardShell
      role="PROVIDER"
      showStatusToggle
      isOnline={isOnline}
      onStatusToggle={toggleAvailability}
    >
      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Hồ sơ cá nhân
        </h1>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          Quản lý thông tin cá nhân, thông tin nghề nghiệp và trạng thái xác
          thực tài khoản.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12">
          <ProviderHero profile={providerProfile} />
        </div>

        <div className="col-span-12">
          <PerformanceStats stats={performanceStats} />
        </div>

        <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
          <ProfileSection
            title="Thông tin cá nhân"
            actionLabel="Cập nhật thông tin"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="Họ và tên" value={providerProfile.fullName} />
              <InfoField label="Số điện thoại" value={providerProfile.phone} />
              <InfoField label="Email" value={providerProfile.email} />
              <InfoField label="Giới tính" value={providerProfile.gender} />
              <InfoField
                label="Ngày sinh"
                value={providerProfile.birthday}
                wide
              />
            </div>
          </ProfileSection>

          <ProfileSection
            title="Thông tin nghề nghiệp"
            actionLabel="Chỉnh sửa nghề nghiệp"
          >
            <div className="space-y-6">
              <InfoField
                label="Dịch vụ chính"
                value={
                  <span className="font-body-lg font-bold text-primary">
                    {providerProfile.mainService}
                  </span>
                }
              />
              <InfoField
                label="Kỹ năng chuyên môn"
                value={<SkillTags skills={providerProfile.skills} />}
              />
              <InfoField
                label="Kinh nghiệm"
                value={providerProfile.experience}
              />
              <InfoField
                label="Giới thiệu bản thân"
                value={
                  <p className="text-on-surface-variant leading-relaxed">
                    {providerProfile.bio}
                  </p>
                }
              />
            </div>
          </ProfileSection>

          <ProfileSection title="Portfolio dự án">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 -mt-2">
              <p className="text-xs text-on-surface-variant">
                Tổng cộng 48 ảnh công việc đã thực hiện
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="bg-surface-container text-on-surface px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-surface-container-high transition-all"
                >
                  <span className="material-symbols-outlined text-sm">
                    add_photo_alternate
                  </span>
                  Thêm ảnh
                </button>
                <button
                  type="button"
                  className="bg-surface-container text-on-surface px-4 py-2 rounded-lg font-bold text-sm hover:bg-surface-container-high transition-all"
                >
                  Quản lý
                </button>
              </div>
            </div>
            <PortfolioGrid items={portfolioItems} />
          </ProfileSection>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
          <VerificationPanel items={verificationItems} />
          <ServiceAreaPanel area={serviceArea} />
          <BankAccountPanel account={bankAccount} />
          <SettingsMenu />
          <DangerZone />
        </div>
      </div>
    </DashboardShell>
  );
};

export default ProviderProfilePage;
