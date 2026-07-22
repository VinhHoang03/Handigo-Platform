import type { UserProfileData } from "@/features/profile/types/profile.types";
import type {
  CertificateStatus,
  IdentityDocument,
  IdentityDocumentType,
  PerformanceStat,
  ProviderCertificate,
  ProviderOcrSuggestion,
  ProviderProfile,
  ProviderProfileResponse,
  ServiceArea,
  VerificationItem,
  VerificationStatus,
} from "../types/provider.types";

export type ProfessionalForm = {
  bio: string;
  serviceIds: string[];
};

export type IdentityForm = {
  type: IdentityDocumentType;
  documentNumber: string;
  fullName: string;
  issuedPlace: string;
  issuedAt: string;
  expiresAt: string;
  frontImageUrl: string;
  backImageUrl: string;
  passportImageUrl: string;
  consentAccepted: boolean;
};

export type CertificateForm = {
  id?: string;
  title: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  imageUrls: string[];
  description: string;
  isPublic: boolean;
};

export type PasswordForm = {
  current: string;
  next: string;
  confirm: string;
};

export type VerificationActionItem = VerificationItem & {
  onClick?: () => void;
};

export const emptyProfessionalForm: ProfessionalForm = {
  bio: "",
  serviceIds: [],
};

export const emptyIdentityForm: IdentityForm = {
  type: "cccd",
  documentNumber: "",
  fullName: "",
  issuedPlace: "",
  issuedAt: "",
  expiresAt: "",
  frontImageUrl: "",
  backImageUrl: "",
  passportImageUrl: "",
  consentAccepted: false,
};

export const emptyCertificateForm: CertificateForm = {
  title: "",
  issuer: "",
  issuedAt: "",
  expiresAt: "",
  imageUrls: [],
  description: "",
  isPublic: false,
};

export const emptyPasswordForm: PasswordForm = {
  current: "",
  next: "",
  confirm: "",
};

export const identityStatusLabel: Record<VerificationStatus, string> = {
  unsubmitted: "Chưa gửi",
  pending: "Đang chờ duyệt",
  verified: "Đã xác thực",
  rejected: "Bị từ chối",
};

export const certificateStatusLabel: Record<CertificateStatus, string> = {
  pending: "Đang chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
};

export const statusTone = (
  status?: VerificationStatus,
): VerificationItem["statusTone"] => {
  if (status === "verified") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
};

export const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
};

export const toDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const optional = (value: string) => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const toProfessionalForm = (
  profile: ProviderProfileResponse,
): ProfessionalForm => ({
  bio: profile.provider.bio || profile.provider.description || "",
  serviceIds: profile.provider.serviceIds || [],
});

export const toIdentityForm = (identity?: IdentityDocument): IdentityForm => ({
  type: identity?.type || "cccd",
  documentNumber: identity?.documentNumber || identity?.numberLast4 || "",
  fullName: identity?.fullName || "",
  issuedPlace: identity?.issuedPlace || "",
  issuedAt: toDateInput(identity?.issuedAt),
  expiresAt: toDateInput(identity?.expiresAt),
  frontImageUrl: identity?.frontImageUrl || "",
  backImageUrl: identity?.backImageUrl || "",
  passportImageUrl: identity?.passportImageUrl || "",
  consentAccepted: false,
});

export const fillIdentityEmptyFields = (
  identity: IdentityForm,
  suggestion?: ProviderOcrSuggestion,
): IdentityForm => {
  if (!suggestion) return identity;
  return {
    ...identity,
    documentNumber: identity.documentNumber || suggestion.documentNumber || "",
    fullName: identity.fullName || suggestion.fullName || "",
    issuedPlace: identity.issuedPlace || suggestion.issuedPlace || "",
    issuedAt: identity.issuedAt || suggestion.issuedAt || "",
    expiresAt: identity.expiresAt || suggestion.expiresAt || "",
  };
};

export const toCertificateForm = (
  certificate: ProviderCertificate,
): CertificateForm => ({
  id: certificate.id,
  title: certificate.title,
  issuer: certificate.issuer || "",
  issuedAt: toDateInput(certificate.issuedAt),
  expiresAt: toDateInput(certificate.expiresAt),
  imageUrls: certificate.imageUrls,
  description: certificate.description || "",
  isPublic: certificate.isPublic,
});

export const toUserProfileData = (
  profile: ProviderProfileResponse,
): UserProfileData => ({
  id: profile.user.id,
  fullName: profile.user.fullName,
  email: profile.user.email,
  phone: profile.user.phone,
  avatar: profile.user.avatar,
  avatarUrl: profile.user.avatar || "",
  birthday: profile.user.birthday,
  gender: profile.user.gender,
  createdAt: profile.user.createdAt,
});

export const documentLast4 = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
};

export const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ||
  url.includes("/image/upload/");

export const buildProviderProfileView = (
  profile: ProviderProfileResponse | null,
): ProviderProfile | null => {
  if (!profile) return null;

  const serviceNames =
    profile.provider.services?.map((service) => service.name).filter(Boolean) ||
    [];

  return {
    fullName: profile.user.fullName,
    email: profile.user.email,
    phone: profile.user.phone || "Chưa cập nhật",
    gender: profile.user.gender || "Chưa cập nhật",
    birthday: formatDate(profile.user.birthday),
    bio: profile.provider.bio || profile.provider.description || "Chưa cập nhật",
    mainService: serviceNames[0] || "Chưa cập nhật",
    experience: `${profile.provider.experienceYears} năm kinh nghiệm`,
    skills: serviceNames,
    certifications: profile.provider.certificates.map((certificate) => ({
      id: certificate.id,
      title: certificate.title,
      expiryDate: certificate.expiresAt
        ? formatDate(certificate.expiresAt)
        : "Không thời hạn",
    })),
    rating: profile.provider.averageRating || 0,
    reviewCount: profile.provider.totalFeedbacks || 0,
    totalBookings: profile.provider.totalCompletedOrders || 0,
    isVerified: profile.provider.verified,
    joinDate: profile.user.createdAt
      ? String(new Date(profile.user.createdAt).getFullYear())
      : "N/A",
    avatarUrl: profile.user.avatar || "",
  };
};

export const buildPerformanceStats = (
  profile: ProviderProfileResponse | null,
  availabilityStatus: string,
): PerformanceStat[] => {
  if (!profile) return [];

  return [
    {
      label: "Đánh giá trung bình",
      value: profile.provider.averageRating.toFixed(2),
      meta: `${profile.provider.totalFeedbacks} đánh giá`,
    },
    {
      label: "Đơn hoàn tất",
      value: String(profile.provider.totalCompletedOrders),
      meta: "Tổng cộng",
    },
    {
      label: "Trạng thái",
      value: availabilityStatus,
      meta: "Hiện tại",
      tone: availabilityStatus === "online" ? "success" : "warning",
    },
    {
      label: "Chứng chỉ",
      value: String(profile.provider.certificates.length),
      meta: "Đã khai báo",
    },
  ];
};

export const buildServiceArea = (
  profile: ProviderProfileResponse | null,
): ServiceArea => ({
  province: profile?.provider.serviceArea?.province,
  ward: profile?.provider.serviceArea?.ward,
  workingAreas: profile?.provider.workingAreas,
});

export const buildVerificationItems = (
  profile: ProviderProfileResponse,
  onPhoneVerificationClick: () => void,
  onIdentityClick: () => void,
): VerificationActionItem[] => {
  const identityStatus =
    profile.provider.identityDocument?.verificationStatus || "unsubmitted";

  return [
    {
      label: "Email",
      status: profile.user.email ? "Đã cập nhật" : "Chưa cập nhật",
      statusTone: profile.user.email ? "approved" : "pending",
    },
    {
      label: "Số điện thoại",
      status: profile.user.phone ? "Đã cập nhật" : "Cần bổ sung",
      statusTone: profile.user.phone ? "approved" : "pending",
      onClick: onPhoneVerificationClick,
    },
    {
      label: "CCCD/Hộ chiếu",
      status: identityStatusLabel[identityStatus],
      statusTone: statusTone(identityStatus),
      onClick: onIdentityClick,
    },
  ];
};
