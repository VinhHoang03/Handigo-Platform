import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { AddressBookModal } from "@/components/profile/AddressBookModal";
import { UserProfileSection } from "@/components/profile/UserProfileSection";
import { changePasswordApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  createUserAddress,
  deleteUserAddress,
  getUserAddresses,
  updateUserAddress,
} from "@/features/profile/api/addressBook.api";
import { updateUserProfile } from "@/features/profile/api/userProfile.api";
import type {
  UserAddress,
  UserAddressPayload,
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";
import {
  AccountFunctionsPanel,
  InfoField,
  PerformanceStats,
  ProfileSection,
  ProviderHero,
  ServiceAreaPanel,
  SkillTags,
  VerificationPanel,
} from "../components/ProviderProfileComponents";
import { providerProfileApi } from "../api/providerProfile.api";
import { useProviderAvailability } from "../hooks/useProviderAvailability";
import type {
  CertificateStatus,
  IdentityDocument,
  IdentityDocumentType,
  PerformanceStat,
  ProviderCertificate,
  ProviderProfile,
  ProviderProfileResponse,
  ServiceArea,
  SubmitIdentityPayload,
  VerificationItem,
  VerificationStatus,
} from "../types/provider.types";

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=Provider&background=E8DEF8&color=21005D";

type ProfessionalForm = {
  bio: string;
  province: string;
  ward: string;
};

type IdentityForm = {
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

type CertificateForm = {
  id?: string;
  title: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  imageUrls: string[];
  description: string;
};

const emptyProfessionalForm: ProfessionalForm = {
  bio: "",
  province: "",
  ward: "",
};

const emptyIdentityForm: IdentityForm = {
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

const emptyCertificateForm: CertificateForm = {
  title: "",
  issuer: "",
  issuedAt: "",
  expiresAt: "",
  imageUrls: [],
  description: "",
};

const identityStatusLabel: Record<VerificationStatus, string> = {
  unsubmitted: "Chưa gửi",
  pending: "Đang chờ duyệt",
  verified: "Đã xác thực",
  rejected: "Bị từ chối",
};

const certificateStatusLabel: Record<CertificateStatus, string> = {
  pending: "Đang chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
};

const statusTone = (
  status?: VerificationStatus,
): VerificationItem["statusTone"] => {
  if (status === "verified") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
};

const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
};

const toDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const optional = (value: string) => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || fallback;
};

const toProfessionalForm = (
  profile: ProviderProfileResponse,
): ProfessionalForm => ({
  bio: profile.provider.bio || profile.provider.description || "",
  province: profile.provider.serviceArea?.province || "",
  ward: profile.provider.serviceArea?.ward || "",
});

const toIdentityForm = (identity?: IdentityDocument): IdentityForm => ({
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

const toCertificateForm = (
  certificate: ProviderCertificate,
): CertificateForm => ({
  id: certificate.id,
  title: certificate.title,
  issuer: certificate.issuer || "",
  issuedAt: toDateInput(certificate.issuedAt),
  expiresAt: toDateInput(certificate.expiresAt),
  imageUrls: certificate.imageUrls,
  description: certificate.description || "",
});

const toUserProfileData = (
  profile: ProviderProfileResponse,
): UserProfileData => ({
  id: profile.user.id,
  fullName: profile.user.fullName,
  email: profile.user.email,
  phone: profile.user.phone,
  avatar: profile.user.avatar,
  avatarUrl: profile.user.avatar || DEFAULT_AVATAR,
  birthday: profile.user.birthday,
  gender: profile.user.gender,
  createdAt: profile.user.createdAt,
});

const documentLast4 = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
};

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ||
  url.includes("/image/upload/");

function TextInput({
  id,
  label,
  value,
  type = "text",
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <textarea
        id={id}
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UploadedAsset({
  url,
  label,
  onRemove,
}: {
  url: string;
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-white p-3">
      {isImageUrl(url) ? (
        <img
          src={url}
          alt={label}
          className="h-28 w-full rounded-lg object-cover"
        />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-28 items-center justify-center rounded-lg bg-surface-container-low text-sm font-bold text-primary"
        >
          Xem tài liệu
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          className="mt-2 text-xs font-bold text-error hover:underline"
          onClick={onRemove}
        >
          Xóa
        </button>
      )}
    </div>
  );
}

function FileUploadSlot({
  id,
  label,
  value,
  accept,
  uploading,
  onUpload,
  onRemove,
}: {
  id: string;
  label: string;
  value?: string;
  accept: string;
  uploading?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-on-surface-variant">
          {label}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90">
          <span className="material-symbols-outlined text-[18px]">upload</span>
          {uploading ? "Đang tải..." : value ? "Thay đổi" : "Tải lên"}
          <input
            id={id}
            type="file"
            accept={accept}
            disabled={uploading}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
      {value ? (
        <UploadedAsset url={value} label={label} onRemove={onRemove} />
      ) : (
        <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-sm text-on-surface-variant">
          Chưa có tệp.
        </div>
      )}
    </div>
  );
}

function IdentityDocumentForm({
  form,
  error,
  isSaving,
  uploadingAsset,
  onChange,
  onUpload,
  onSubmit,
}: {
  form: IdentityForm;
  error?: string;
  isSaving?: boolean;
  uploadingAsset?: string | null;
  onChange: (form: IdentityForm) => void;
  onUpload: (
    field: "frontImageUrl" | "backImageUrl" | "passportImageUrl",
    file: File,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField<IdentityDocumentType>
          id="identity-type"
          label="Loại giấy tờ"
          value={form.type}
          options={[
            { label: "CCCD", value: "cccd" },
            { label: "Hộ chiếu", value: "passport" },
          ]}
          onChange={(value) => onChange({ ...form, type: value })}
        />
        <TextInput
          id="identity-document-number"
          label="Số giấy tờ"
          value={form.documentNumber}
          required
          onChange={(value) => onChange({ ...form, documentNumber: value })}
        />
        <TextInput
          id="identity-full-name"
          label="Họ tên trên giấy tờ"
          value={form.fullName}
          required
          onChange={(value) => onChange({ ...form, fullName: value })}
        />
        <TextInput
          id="identity-issued-place"
          label="Nơi cấp"
          value={form.issuedPlace}
          onChange={(value) => onChange({ ...form, issuedPlace: value })}
        />
        <TextInput
          id="identity-issued-at"
          label="Ngày cấp"
          type="date"
          value={form.issuedAt}
          onChange={(value) => onChange({ ...form, issuedAt: value })}
        />
        <TextInput
          id="identity-expires-at"
          label="Ngày hết hạn"
          type="date"
          value={form.expiresAt}
          onChange={(value) => onChange({ ...form, expiresAt: value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {form.type === "cccd" ? (
          <>
            <FileUploadSlot
              id="identity-front-upload"
              label="Ảnh mặt trước"
              value={form.frontImageUrl}
              accept="image/*"
              uploading={uploadingAsset === "frontImageUrl"}
              onUpload={(file) => onUpload("frontImageUrl", file)}
              onRemove={() => onChange({ ...form, frontImageUrl: "" })}
            />
            <FileUploadSlot
              id="identity-back-upload"
              label="Ảnh mặt sau (nếu cần)"
              value={form.backImageUrl}
              accept="image/*"
              uploading={uploadingAsset === "backImageUrl"}
              onUpload={(file) => onUpload("backImageUrl", file)}
              onRemove={() => onChange({ ...form, backImageUrl: "" })}
            />
          </>
        ) : (
          <FileUploadSlot
            id="identity-passport-upload"
            label="Ảnh hộ chiếu"
            value={form.passportImageUrl}
            accept="image/*"
            uploading={uploadingAsset === "passportImageUrl"}
            onUpload={(file) => onUpload("passportImageUrl", file)}
            onRemove={() => onChange({ ...form, passportImageUrl: "" })}
          />
        )}
      </div>

      <label className="flex items-start gap-3 rounded-lg bg-surface-container-low p-4 text-sm">
        <input
          type="checkbox"
          checked={form.consentAccepted}
          required
          onChange={(event) =>
            onChange({ ...form, consentAccepted: event.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
        />
        <span>
          Tôi đồng ý cho Handigo xử lý dữ liệu giấy tờ cá nhân để xác thực tài
          khoản provider.
        </span>
      </label>

      <div className="flex flex-col justify-end gap-3 sm:flex-row">
        <button type="submit" className="btn-primary" disabled={isSaving}>
          {isSaving ? "Đang gửi..." : "Gửi xác thực"}
        </button>
      </div>
    </form>
  );
}

function CertificateInlineForm({
  form,
  error,
  isSaving,
  uploading,
  onChange,
  onUpload,
  onCancel,
  onSubmit,
}: {
  form: CertificateForm;
  error?: string;
  isSaving?: boolean;
  uploading?: boolean;
  onChange: (form: CertificateForm) => void;
  onUpload: (file: File) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4 md:grid-cols-2"
      onSubmit={onSubmit}
    >
      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error md:col-span-2">
          {error}
        </div>
      )}
      <TextInput
        id="certificate-title"
        label="Tên chứng chỉ"
        value={form.title}
        required
        onChange={(value) => onChange({ ...form, title: value })}
      />
      <TextInput
        id="certificate-issuer"
        label="Đơn vị cấp"
        value={form.issuer}
        onChange={(value) => onChange({ ...form, issuer: value })}
      />
      <TextInput
        id="certificate-issued-at"
        label="Ngày cấp"
        type="date"
        value={form.issuedAt}
        onChange={(value) => onChange({ ...form, issuedAt: value })}
      />
      <TextInput
        id="certificate-expires-at"
        label="Ngày hết hạn"
        type="date"
        value={form.expiresAt}
        onChange={(value) => onChange({ ...form, expiresAt: value })}
      />
      <div className="space-y-3 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase text-on-surface-variant">
            Ảnh hoặc tài liệu chứng chỉ
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90">
            <span className="material-symbols-outlined text-[18px]">upload</span>
            {uploading ? "Đang tải..." : "Tải lên Cloudinary"}
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              disabled={uploading}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) onUpload(file);
              }}
            />
          </label>
        </div>
        {form.imageUrls.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {form.imageUrls.map((url) => (
              <UploadedAsset
                key={url}
                url={url}
                label={form.title || "Chứng chỉ"}
                onRemove={() =>
                  onChange({
                    ...form,
                    imageUrls: form.imageUrls.filter((item) => item !== url),
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-outline-variant/60 bg-white/70 p-5 text-center text-sm text-on-surface-variant">
            Chưa có tệp chứng chỉ.
          </div>
        )}
      </div>
      <TextArea
        id="certificate-description"
        label="Mô tả"
        value={form.description}
        onChange={(value) => onChange({ ...form, description: value })}
      />
      <div className="flex justify-end gap-3 pt-2 md:col-span-2">
        <button
          type="button"
          className="rounded-lg bg-surface-container px-4 py-2 font-bold"
          disabled={isSaving}
          onClick={onCancel}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
          disabled={isSaving}
        >
          {isSaving ? "Đang lưu..." : "Lưu chứng chỉ"}
        </button>
      </div>
    </form>
  );
}

export default function ProviderProfilePage() {
  const { isOnline, toggleAvailability } = useProviderAvailability();
  const userProfileSectionRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<ProviderProfileResponse | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddressLoading, setIsAddressLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAddressSaving, setIsAddressSaving] = useState(false);
  const [isEditingProfessional, setIsEditingProfessional] = useState(false);
  const [isCertificateFormOpen, setIsCertificateFormOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [phoneHighlighted, setPhoneHighlighted] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState("");
  const [certificateError, setCertificateError] = useState("");
  const [professionalForm, setProfessionalForm] =
    useState<ProfessionalForm>(emptyProfessionalForm);
  const [identityForm, setIdentityForm] =
    useState<IdentityForm>(emptyIdentityForm);
  const [certificateForm, setCertificateForm] =
    useState<CertificateForm>(emptyCertificateForm);

  const [isPwdConfirmOpen, setIsPwdConfirmOpen] = useState(false);
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdData, setPwdData] = useState({ current: "", next: "", confirm: "" });
  const [pwdError, setPwdError] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const syncAuthUser = useCallback((nextUser: UserProfileData) => {
    const { user, setUser } = useAuthStore.getState();
    if (!user) return;

    const syncedUser = {
      ...user,
      fullName: nextUser.fullName,
      phone: nextUser.phone || undefined,
      avatar: nextUser.avatar ?? null,
      birthday: nextUser.birthday,
      gender: nextUser.gender,
    };

    const hasChanged =
      user.fullName !== syncedUser.fullName ||
      (user.phone || undefined) !== syncedUser.phone ||
      (user.avatar ?? null) !== syncedUser.avatar ||
      (user.birthday ?? null) !== (syncedUser.birthday ?? null) ||
      (user.gender ?? null) !== (syncedUser.gender ?? null);

    if (hasChanged) setUser(syncedUser);
  }, []);

  const loadAddresses = useCallback(async () => {
    setIsAddressLoading(true);
    try {
      const nextAddresses = await getUserAddresses();
      setAddresses(nextAddresses);
      setAddressError("");
    } catch {
      setAddressError("Không tải được địa chỉ đã lưu.");
    } finally {
      setIsAddressLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await providerProfileApi.getProfile();
      setProfile(nextProfile);
      setProfessionalForm(toProfessionalForm(nextProfile));
      syncAuthUser(toUserProfileData(nextProfile));
    } catch {
      setError("Không thể tải hồ sơ provider.");
    } finally {
      setIsLoading(false);
    }
  }, [syncAuthUser]);

  useEffect(() => {
    // Initial remote loads are intentionally started from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
    void loadAddresses();
  }, [loadAddresses, loadProfile]);

  const profileView = useMemo<ProviderProfile | null>(() => {
    if (!profile) return null;

    const serviceNames =
      profile.provider.services
        ?.map((service) => service.name)
        .filter(Boolean) || [];

    return {
      fullName: profile.user.fullName,
      email: profile.user.email,
      phone: profile.user.phone || "Chưa cập nhật",
      gender: profile.user.gender || "Chưa cập nhật",
      birthday: formatDate(profile.user.birthday),
      bio:
        profile.provider.bio || profile.provider.description || "Chưa cập nhật",
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
      providerCode: profile.provider.id,
      isVerified: profile.provider.verified,
      joinDate: profile.user.createdAt
        ? String(new Date(profile.user.createdAt).getFullYear())
        : "N/A",
      avatarUrl: profile.user.avatar || DEFAULT_AVATAR,
    };
  }, [profile]);

  const performanceStats = useMemo<PerformanceStat[]>(() => {
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
        value: profile.provider.availabilityStatus,
        meta: "Hiện tại",
        tone:
          profile.provider.availabilityStatus === "online"
            ? "success"
            : "warning",
      },
      {
        label: "Chứng chỉ",
        value: String(profile.provider.certificates.length),
        meta: "Đã khai báo",
      },
    ];
  }, [profile]);

  const serviceArea = useMemo<ServiceArea>(
    () => ({
      province: profile?.provider.serviceArea?.province,
      ward: profile?.provider.serviceArea?.ward,
    }),
    [profile],
  );

  const refreshAddresses = async () => {
    const nextAddresses = await getUserAddresses();
    setAddresses(nextAddresses);
    setAddressError("");
  };

  const handleUserProfileSave = async (payload: UserProfileFormValue) => {
    setIsSaving(true);
    setError(null);

    try {
      const nextUser = await updateUserProfile(payload);
      setProfile((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                fullName: nextUser.fullName,
                phone: nextUser.phone || undefined,
                avatar: nextUser.avatar ?? null,
                birthday: nextUser.birthday,
                gender: nextUser.gender,
              },
            }
          : current,
      );
      syncAuthUser(nextUser);
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.",
        ),
      );
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitAddress = async (
    payload: UserAddressPayload,
    address: UserAddress | null,
  ) => {
    setIsAddressSaving(true);
    try {
      if (address) {
        await updateUserAddress(address.id, payload);
      } else {
        await createUserAddress(payload);
      }
      await refreshAddresses();
    } catch (saveError) {
      setAddressError(
        getErrorMessage(saveError, "Không thể lưu địa chỉ. Vui lòng thử lại."),
      );
      throw saveError;
    } finally {
      setIsAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (address: UserAddress) => {
    setIsAddressSaving(true);
    try {
      await deleteUserAddress(address.id);
      await refreshAddresses();
    } catch (deleteError) {
      setAddressError(
        getErrorMessage(deleteError, "Không thể xóa địa chỉ. Vui lòng thử lại."),
      );
      throw deleteError;
    } finally {
      setIsAddressSaving(false);
    }
  };

  const handleProfessionalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSaving(true);
    setError(null);
    try {
      const nextProfile = await providerProfileApi.updateProfile({
        bio: optional(professionalForm.bio),
        serviceArea: {
          province: optional(professionalForm.province),
          ward: optional(professionalForm.ward),
        },
      });

      setProfile(nextProfile);
      setProfessionalForm(toProfessionalForm(nextProfile));
      setIsEditingProfessional(false);
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "Không thể cập nhật hồ sơ nghề nghiệp. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleIdentityFileUpload = async (
    field: "frontImageUrl" | "backImageUrl" | "passportImageUrl",
    file: File,
  ) => {
    setUploadingAsset(field);
    setIdentityError("");
    try {
      const uploaded = await providerProfileApi.uploadImage(file, "identity");
      setIdentityForm((current) => ({
        ...current,
        [field]: uploaded.url,
      }));
    } catch (uploadError) {
      setIdentityError(
        getErrorMessage(
          uploadError,
          "Không thể upload ảnh giấy tờ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleCertificateFileUpload = async (file: File) => {
    setUploadingAsset("certificate");
    setCertificateError("");
    try {
      const uploaded = await providerProfileApi.uploadImage(file, "certificate");
      setCertificateForm((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, uploaded.url],
      }));
    } catch (uploadError) {
      setCertificateError(
        getErrorMessage(
          uploadError,
          "Không thể upload chứng chỉ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleIdentitySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIdentityError("");

    if (!identityForm.documentNumber.trim()) {
      setIdentityError("Vui lòng nhập số giấy tờ.");
      return;
    }

    if (!identityForm.fullName.trim()) {
      setIdentityError("Vui lòng nhập họ tên trên giấy tờ.");
      return;
    }

    if (identityForm.type === "cccd" && !identityForm.frontImageUrl) {
      setIdentityError("Vui lòng upload ảnh mặt trước CCCD.");
      return;
    }

    if (identityForm.type === "passport" && !identityForm.passportImageUrl) {
      setIdentityError("Vui lòng upload ảnh hộ chiếu.");
      return;
    }

    if (!identityForm.consentAccepted) {
      setIdentityError("Vui lòng xác nhận đồng ý xử lý dữ liệu giấy tờ.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: SubmitIdentityPayload = {
        type: identityForm.type,
        documentNumber: optional(identityForm.documentNumber),
        numberLast4: documentLast4(identityForm.documentNumber),
        fullName: optional(identityForm.fullName),
        issuedPlace: optional(identityForm.issuedPlace),
        issuedAt: optional(identityForm.issuedAt),
        expiresAt: optional(identityForm.expiresAt),
        frontImageUrl:
          identityForm.type === "cccd"
            ? optional(identityForm.frontImageUrl)
            : undefined,
        backImageUrl:
          identityForm.type === "cccd"
            ? optional(identityForm.backImageUrl)
            : undefined,
        passportImageUrl:
          identityForm.type === "passport"
            ? optional(identityForm.passportImageUrl)
            : undefined,
        consentAccepted: identityForm.consentAccepted,
      };
      const nextProfile = await providerProfileApi.submitIdentity(payload);

      setProfile(nextProfile);
      setIdentityForm(emptyIdentityForm);
      setIsIdentityModalOpen(false);
    } catch (submitError) {
      setIdentityError(
        getErrorMessage(
          submitError,
          "Không thể gửi giấy tờ xác thực. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCertificateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCertificateError("");

    if (!certificateForm.title.trim()) {
      setCertificateError("Vui lòng nhập tên chứng chỉ.");
      return;
    }

    if (certificateForm.imageUrls.length === 0) {
      setCertificateError("Vui lòng upload ít nhất một ảnh hoặc tài liệu chứng chỉ.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: certificateForm.title.trim(),
        issuer: optional(certificateForm.issuer),
        issuedAt: optional(certificateForm.issuedAt),
        expiresAt: optional(certificateForm.expiresAt),
        imageUrls: certificateForm.imageUrls,
        description: optional(certificateForm.description),
      };

      const nextProfile = certificateForm.id
        ? await providerProfileApi.updateCertificate(
            certificateForm.id,
            payload,
          )
        : await providerProfileApi.createCertificate(payload);

      setProfile(nextProfile);
      setCertificateForm(emptyCertificateForm);
      setIsCertificateFormOpen(false);
    } catch (submitError) {
      setCertificateError(
        getErrorMessage(
          submitError,
          "Không thể lưu chứng chỉ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCertificate = async (certificateId: string) => {
    const confirmed = window.confirm("Xóa chứng chỉ này?");
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const nextProfile =
        await providerProfileApi.deleteCertificate(certificateId);
      setProfile(nextProfile);
    } finally {
      setIsSaving(false);
    }
  };

  const openProfessionalEdit = () => {
    if (profile) setProfessionalForm(toProfessionalForm(profile));
    setIsEditingProfessional(true);
  };

  const openCreateAddressModal = () => {
    setEditingAddress(null);
    setAddressError("");
    setIsAddressModalOpen(true);
  };

  const openEditAddressModal = (address: UserAddress) => {
    setEditingAddress(address);
    setAddressError("");
    setIsAddressModalOpen(true);
  };

  const closeAddressModal = () => {
    setIsAddressModalOpen(false);
    setEditingAddress(null);
  };

  const openIdentityModal = () => {
    setIdentityForm(toIdentityForm(profile?.provider.identityDocument));
    setIdentityError("");
    setIsIdentityModalOpen(true);
  };

  const handlePhoneVerificationClick = () => {
    if (profile?.user.phone) return;

    userProfileSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setPhoneHighlighted(true);
    window.setTimeout(() => setPhoneHighlighted(false), 2600);
  };

  const openCreateCertificateForm = () => {
    setCertificateForm(emptyCertificateForm);
    setCertificateError("");
    setIsCertificateFormOpen(true);
  };

  const openEditCertificateForm = (certificate: ProviderCertificate) => {
    setCertificateForm(toCertificateForm(certificate));
    setCertificateError("");
    setIsCertificateFormOpen(true);
  };

  const closePasswordModal = () => {
    setIsPwdModalOpen(false);
    setPwdData({ current: "", next: "", confirm: "" });
    setPwdError("");
    setPwdMsg("");
  };

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPwdError("");
    setPwdMsg("");

    if (!pwdData.current.trim()) {
      setPwdError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (pwdData.next.length < 8) {
      setPwdError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    if (pwdData.next !== pwdData.confirm) {
      setPwdError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setIsUpdatingPwd(true);
      await changePasswordApi({
        currentPassword: pwdData.current,
        newPassword: pwdData.next,
      });
      setPwdMsg("Cập nhật mật khẩu thành công.");
      window.setTimeout(closePasswordModal, 1200);
    } catch (passwordError) {
      setPwdError(
        getErrorMessage(
          passwordError,
          "Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.",
        ),
      );
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardShell
        role="PROVIDER"
        showStatusToggle
        isOnline={isOnline}
        onStatusToggle={toggleAvailability}
      >
        <div className="rounded-xl bg-white p-8 text-center text-on-surface-variant">
          Đang tải hồ sơ...
        </div>
      </DashboardShell>
    );
  }

  if (error || !profile || !profileView) {
    return (
      <DashboardShell
        role="PROVIDER"
        showStatusToggle
        isOnline={isOnline}
        onStatusToggle={toggleAvailability}
      >
        <div className="rounded-xl border border-error/20 bg-error/10 p-8 text-center text-error">
          <p>{error || "Không thể mở hồ sơ provider."}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-error px-4 py-2 font-bold text-on-error"
            onClick={() => void loadProfile()}
          >
            Thử lại
          </button>
        </div>
      </DashboardShell>
    );
  }

  const identityDocument = profile.provider.identityDocument;
  const identityStatus = identityDocument?.verificationStatus || "unsubmitted";
  const verificationItems: Array<VerificationItem & { onClick?: () => void }> = [
    {
      label: "Email",
      status: profile.user.email ? "Đã cập nhật" : "Chưa cập nhật",
      statusTone: profile.user.email ? "approved" : "pending",
    },
    {
      label: "Số điện thoại",
      status: profile.user.phone ? "Đã cập nhật" : "Cần bổ sung",
      statusTone: profile.user.phone ? "approved" : "pending",
      onClick: handlePhoneVerificationClick,
    },
    {
      label: "CCCD/Hộ chiếu",
      status: identityStatusLabel[identityStatus],
      statusTone: statusTone(identityStatus),
      onClick: openIdentityModal,
    },
  ];

  return (
    <DashboardShell
      role="PROVIDER"
      showStatusToggle
      isOnline={isOnline}
      onStatusToggle={toggleAvailability}
    >
      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12">
          <ProviderHero profile={profileView} />
        </div>

        <div className="col-span-12">
          <PerformanceStats stats={performanceStats} />
        </div>

        <div className="col-span-12 flex flex-col gap-gutter lg:col-span-8">
          <div ref={userProfileSectionRef}>
            <UserProfileSection
              user={toUserProfileData(profile)}
              addresses={addresses}
              isSaving={isSaving}
              isAddressLoading={isAddressLoading}
              isAddressSaving={isAddressSaving}
              error={error || undefined}
              addressError={addressError}
              defaultAvatar={DEFAULT_AVATAR}
              showAvatar={false}
              highlightPhone={phoneHighlighted}
              onSaveProfile={handleUserProfileSave}
              onAddAddress={openCreateAddressModal}
              onEditAddress={openEditAddressModal}
              onDeleteAddress={handleDeleteAddress}
            />
          </div>

          <ProfileSection
            title="Thông tin nghề nghiệp"
            actionLabel={
              isEditingProfessional ? undefined : "Chỉnh sửa nghề nghiệp"
            }
            onAction={openProfessionalEdit}
          >
            {isEditingProfessional ? (
              <form
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
                onSubmit={handleProfessionalSubmit}
              >
                <TextInput
                  id="provider-province"
                  label="Tỉnh/Thành phố phục vụ"
                  value={professionalForm.province}
                  onChange={(value) =>
                    setProfessionalForm((current) => ({
                      ...current,
                      province: value,
                    }))
                  }
                />
                <TextInput
                  id="provider-ward"
                  label="Xã/Phường phục vụ"
                  value={professionalForm.ward}
                  onChange={(value) =>
                    setProfessionalForm((current) => ({
                      ...current,
                      ward: value,
                    }))
                  }
                />
                <TextArea
                  id="provider-bio"
                  label="Giới thiệu chuyên môn"
                  value={professionalForm.bio}
                  onChange={(value) =>
                    setProfessionalForm((current) => ({
                      ...current,
                      bio: value,
                    }))
                  }
                />
                <div className="flex justify-end gap-3 md:col-span-2">
                  <button
                    type="button"
                    className="rounded-lg bg-surface-container px-4 py-2 font-bold"
                    disabled={isSaving}
                    onClick={() => {
                      setProfessionalForm(toProfessionalForm(profile));
                      setIsEditingProfessional(false);
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
                    disabled={isSaving}
                  >
                    {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <InfoField
                  label="Giới thiệu chuyên môn"
                  value={
                    <p className="leading-relaxed text-on-surface-variant">
                      {profileView.bio}
                    </p>
                  }
                />
                <InfoField label="Kinh nghiệm" value={profileView.experience} />
                <InfoField
                  label="Các dịch vụ"
                  value={<SkillTags skills={profileView.skills} />}
                />
              </div>
            )}
          </ProfileSection>

          <ProfileSection
            title="Chứng chỉ nghề nghiệp"
            actionLabel={isCertificateFormOpen ? undefined : "Thêm chứng chỉ"}
            onAction={openCreateCertificateForm}
          >
            <div className="space-y-4">
              {isCertificateFormOpen && (
                <CertificateInlineForm
                  form={certificateForm}
                  error={certificateError}
                  isSaving={isSaving}
                  uploading={uploadingAsset === "certificate"}
                  onChange={setCertificateForm}
                  onUpload={(file) => void handleCertificateFileUpload(file)}
                  onSubmit={handleCertificateSubmit}
                  onCancel={() => {
                    setCertificateForm(emptyCertificateForm);
                    setCertificateError("");
                    setIsCertificateFormOpen(false);
                  }}
                />
              )}

              {profile.provider.certificates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">
                  Chưa có chứng chỉ nghề nghiệp.
                </div>
              ) : (
                profile.provider.certificates.map((certificate) => (
                  <div
                    key={certificate.id}
                    className="rounded-xl border border-outline-variant/30 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-on-surface">
                          {certificate.title}
                        </h4>
                        <p className="text-sm text-on-surface-variant">
                          {certificate.issuer || "Chưa cập nhật đơn vị cấp"} •{" "}
                          {certificate.expiresAt
                            ? `Hết hạn ${formatDate(certificate.expiresAt)}`
                            : "Không thời hạn"}
                        </p>
                      </div>
                      <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">
                        {certificateStatusLabel[certificate.status]}
                      </span>
                    </div>
                    {certificate.description && (
                      <p className="mt-3 text-sm text-on-surface-variant">
                        {certificate.description}
                      </p>
                    )}
                    {certificate.rejectionReason && (
                      <p className="mt-3 text-sm font-medium text-error">
                        {certificate.rejectionReason}
                      </p>
                    )}
                    {certificate.imageUrls.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {certificate.imageUrls.map((url) => (
                          <UploadedAsset
                            key={url}
                            url={url}
                            label={certificate.title}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-surface-container px-3 py-2 text-sm font-bold"
                        onClick={() => openEditCertificateForm(certificate)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-error/30 px-3 py-2 text-sm font-bold text-error"
                        disabled={isSaving}
                        onClick={() =>
                          void handleDeleteCertificate(certificate.id)
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ProfileSection>
        </div>

        <div className="col-span-12 flex flex-col gap-gutter lg:col-span-4">
          <VerificationPanel items={verificationItems} />
          <AccountFunctionsPanel
            onPasswordClick={() => setIsPwdConfirmOpen(true)}
          />
          <ServiceAreaPanel area={serviceArea} />
        </div>
      </div>

      {isAddressModalOpen && (
        <AddressBookModal
          key={editingAddress?.id || "new-address"}
          open={isAddressModalOpen}
          address={editingAddress}
          addressCount={addresses.length}
          isSaving={isAddressSaving}
          onClose={closeAddressModal}
          onSubmit={handleSubmitAddress}
        />
      )}

      <Modal
        open={isIdentityModalOpen}
        title="Xác thực CCCD/Hộ chiếu"
        onClose={() => setIsIdentityModalOpen(false)}
        size="lg"
      >
        <IdentityDocumentForm
          form={identityForm}
          error={identityError}
          isSaving={isSaving}
          uploadingAsset={uploadingAsset}
          onChange={setIdentityForm}
          onUpload={(field, file) => void handleIdentityFileUpload(field, file)}
          onSubmit={handleIdentitySubmit}
        />
      </Modal>

      <Modal
        open={isPwdConfirmOpen}
        title="Mật khẩu và bảo mật"
        onClose={() => setIsPwdConfirmOpen(false)}
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-on-surface">
            Bạn có muốn cập nhật mật khẩu không?
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setIsPwdConfirmOpen(false)}
            >
              Không
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                setIsPwdConfirmOpen(false);
                setIsPwdModalOpen(true);
              }}
            >
              Đồng ý
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={isPwdModalOpen}
        title="Cập nhật mật khẩu"
        onClose={closePasswordModal}
        size="sm"
      >
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {(pwdError || pwdMsg) && (
            <div
              className={`rounded-lg p-4 text-sm ${
                pwdError ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
              }`}
            >
              {pwdError || pwdMsg}
            </div>
          )}

          <TextInput
            id="provider-current-password"
            label="Mật khẩu hiện tại"
            type="password"
            value={pwdData.current}
            required
            onChange={(value) =>
              setPwdData((current) => ({ ...current, current: value }))
            }
          />
          <TextInput
            id="provider-new-password"
            label="Mật khẩu mới"
            type="password"
            value={pwdData.next}
            required
            onChange={(value) =>
              setPwdData((current) => ({ ...current, next: value }))
            }
          />
          <TextInput
            id="provider-confirm-password"
            label="Xác nhận mật khẩu mới"
            type="password"
            value={pwdData.confirm}
            required
            onChange={(value) =>
              setPwdData((current) => ({ ...current, confirm: value }))
            }
          />

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={closePasswordModal}
              className="btn-secondary flex-1"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isUpdatingPwd}
              className="btn-primary flex-1"
            >
              {isUpdatingPwd ? "Đang xử lý..." : "Cập nhật"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
