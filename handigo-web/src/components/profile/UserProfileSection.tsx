import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Camera, Eye, EyeOff, MapPin, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type {
  GenderValue,
  UserAddress,
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=Handigo&background=4f46e5&color=fff";

interface UserProfileSectionProps {
  user: UserProfileData;
  addresses: UserAddress[];
  isSaving?: boolean;
  isAddressLoading?: boolean;
  isAddressSaving?: boolean;
  error?: string;
  addressError?: string;
  defaultAvatar?: string;
  showAvatar?: boolean;
  highlightPhone?: boolean;
  onSaveProfile: (payload: UserProfileFormValue) => Promise<void> | void;
  onAddAddress?: () => void;
  onEditAddress?: (address: UserAddress) => void;
  onDeleteAddress?: (address: UserAddress) => Promise<void> | void;
}

const genderLabels: Record<GenderValue, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

const toDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toProfileForm = (user: UserProfileData): UserProfileFormValue => ({
  fullName: user.fullName || "",
  phone: user.phone || "",
  avatar: user.avatar || user.avatarUrl || "",
  birthday: toDateInput(user.birthday),
  gender: user.gender || null,
});

const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
};

const maskEmail = (email?: string | null) => {
  if (!email) return "Chưa cập nhật";
  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  const visibleLength = Math.min(3, Math.max(1, localPart.length));
  return `${localPart.slice(0, visibleLength)}******@${domain}`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || fallback;
};

function DisplayField({
  label,
  value,
  action,
  highlighted,
}: {
  label: string;
  value: string;
  action?: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </label>
      <div
        className={[
          "relative flex min-h-11 items-center rounded-lg border bg-surface-container-low px-3 text-sm text-on-surface transition",
          highlighted
            ? "border-primary shadow-[0_0_0_4px_rgba(79,70,229,0.14)]"
            : "border-outline-variant/30",
          action ? "pr-11" : "",
        ].join(" ")}
      >
        <span className="min-w-0 truncate">{value || "Chưa cập nhật"}</span>
        {action}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  type = "text",
  required,
  highlighted,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  highlighted?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className={[
          "min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15",
          highlighted
            ? "border-primary shadow-[0_0_0_4px_rgba(79,70,229,0.14)]"
            : "border-outline-variant/40",
        ].join(" ")}
      />
    </label>
  );
}

function AddressRow({
  address,
  disabled,
  onEdit,
  onDelete,
}: {
  address: UserAddress;
  disabled?: boolean;
  onEdit?: (address: UserAddress) => void;
  onDelete?: (address: UserAddress) => void;
}) {
  const title =
    address.note?.trim() ||
    [address.ward, address.province].filter(Boolean).join(", ") ||
    "Địa chỉ";

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <MapPin size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-on-surface">{title}</p>
            {address.isDefault && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                Mặc định
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
            {address.fullAddress}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {onEdit && (
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant transition hover:bg-primary/10 hover:text-primary disabled:opacity-40"
            disabled={disabled}
            title="Sửa địa chỉ"
            aria-label="Sửa địa chỉ"
            onClick={() => onEdit(address)}
          >
            <Pencil size={17} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant transition hover:bg-error/10 hover:text-error disabled:opacity-40"
            disabled={disabled}
            title="Xóa địa chỉ"
            aria-label="Xóa địa chỉ"
            onClick={() => onDelete(address)}
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
    </div>
  );
}

export function UserProfileSection({
  user,
  addresses,
  isSaving,
  isAddressLoading,
  isAddressSaving,
  error,
  addressError,
  defaultAvatar = DEFAULT_AVATAR,
  showAvatar = true,
  highlightPhone,
  onSaveProfile,
  onAddAddress,
  onEditAddress,
  onDeleteAddress,
}: UserProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEmailVisible, setIsEmailVisible] = useState(false);
  const [profileForm, setProfileForm] = useState<UserProfileFormValue>(() =>
    toProfileForm(user),
  );
  const [localProfileError, setLocalProfileError] = useState("");

  const avatarSrc = isEditing
    ? profileForm.avatar || user.avatar || user.avatarUrl || defaultAvatar
    : user.avatar || user.avatarUrl || defaultAvatar;

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalProfileError("");

    if (!profileForm.fullName.trim()) {
      setLocalProfileError("Vui lòng nhập họ và tên.");
      return;
    }

    try {
      await onSaveProfile({
        fullName: profileForm.fullName.trim(),
        phone: profileForm.phone?.trim() || undefined,
        avatar: showAvatar ? profileForm.avatar?.trim() || null : user.avatar || null,
        birthday: profileForm.birthday || null,
        gender: profileForm.gender || null,
      });
      setIsEditing(false);
    } catch (saveError) {
      setLocalProfileError(
        getErrorMessage(saveError, "Không thể cập nhật hồ sơ. Vui lòng thử lại."),
      );
    }
  };

  const handleAvatarFileChange = (file?: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((current) => ({
        ...current,
        avatar: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAddress = async (address: UserAddress) => {
    const confirmed = window.confirm(`Xóa địa chỉ "${address.fullAddress}"?`);
    if (!confirmed) return;
    await onDeleteAddress?.(address);
  };

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-headline-md text-headline-md text-on-surface">
          Thông tin cá nhân
        </h3>
        {!isEditing && (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            onClick={() => {
              setProfileForm(toProfileForm(user));
              setLocalProfileError("");
              setIsEditing(true);
            }}
          >
            <Pencil size={16} />
            Chỉnh sửa hồ sơ
          </button>
        )}
      </div>

      {(error || localProfileError) && (
        <div className="mb-5 rounded-lg bg-error/10 p-3 text-sm font-medium text-error">
          {localProfileError || error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <form onSubmit={handleProfileSubmit} className="min-w-0 space-y-5">
          {showAvatar && (
            <div className="flex items-center gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
              <div className="relative shrink-0">
                <img
                  src={avatarSrc}
                  alt="Ảnh đại diện"
                  className="h-20 w-20 rounded-full border-4 border-primary/10 object-cover shadow-sm"
                />
                {isEditing && (
                  <label
                    htmlFor="shared-avatar-file"
                    className="absolute bottom-0 right-0 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-primary text-on-primary shadow-md transition hover:bg-primary/90"
                    title="Đổi ảnh đại diện"
                  >
                    <Camera size={16} />
                    <input
                      id="shared-avatar-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) =>
                        handleAvatarFileChange(event.target.files?.[0])
                      }
                    />
                  </label>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-on-surface">
                  {user.fullName}
                </p>
                {user.isEmailVerified && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary-container/30 px-2 py-1 text-xs font-bold text-on-secondary-container">
                    <span className="material-symbols-outlined text-sm">
                      verified
                    </span>
                    Email đã xác minh
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {isEditing ? (
              <>
                <TextField
                  id="user-profile-full-name"
                  label="Họ và tên"
                  value={profileForm.fullName}
                  required
                  onChange={(value) =>
                    setProfileForm((current) => ({
                      ...current,
                      fullName: value,
                    }))
                  }
                />
                <TextField
                  id="user-profile-phone"
                  label="Số điện thoại"
                  type="tel"
                  value={profileForm.phone || ""}
                  highlighted={highlightPhone}
                  onChange={(value) =>
                    setProfileForm((current) => ({ ...current, phone: value }))
                  }
                />
                <label className="block space-y-2">
                  <span className="block text-xs font-bold uppercase text-on-surface-variant">
                    Giới tính
                  </span>
                  <select
                    id="user-profile-gender"
                    value={profileForm.gender || ""}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        gender: (event.target.value || null) as
                          | GenderValue
                          | null,
                      }))
                    }
                    className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    <option value="">Chưa cập nhật</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
                <TextField
                  id="user-profile-birthday"
                  label="Ngày sinh"
                  type="date"
                  value={profileForm.birthday || ""}
                  onChange={(value) =>
                    setProfileForm((current) => ({
                      ...current,
                      birthday: value,
                    }))
                  }
                />
              </>
            ) : (
              <>
                <DisplayField label="Họ và tên" value={user.fullName} />
                <DisplayField
                  label="Số điện thoại"
                  value={user.phone || ""}
                  highlighted={highlightPhone}
                />
                <DisplayField
                  label="Giới tính"
                  value={user.gender ? genderLabels[user.gender] : ""}
                />
                <DisplayField label="Ngày sinh" value={formatDate(user.birthday)} />
              </>
            )}

            <DisplayField
              label="Email"
              value={isEmailVisible ? user.email : maskEmail(user.email)}
              action={
                <button
                  type="button"
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface hover:text-primary"
                  title={isEmailVisible ? "Ẩn email" : "Hiện email"}
                  aria-label={isEmailVisible ? "Ẩn email" : "Hiện email"}
                  onClick={() => setIsEmailVisible((visible) => !visible)}
                >
                  {isEmailVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              }
            />
          </div>

          {isEditing && (
            <div className="flex flex-col justify-end gap-3 border-t border-outline-variant/20 pt-5 sm:flex-row">
              <button
                type="button"
                className="btn-secondary"
                disabled={isSaving}
                onClick={() => {
                  setProfileForm(toProfileForm(user));
                  setLocalProfileError("");
                  setIsEditing(false);
                }}
              >
                <X size={17} />
                Hủy thay đổi
              </button>
              <button type="submit" className="btn-primary" disabled={isSaving}>
                <Save size={17} />
                {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          )}
        </form>

        <div className="min-w-0 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface">
                Địa chỉ đã lưu
              </h4>
              <p className="mt-1 text-sm text-on-surface-variant">
                Dùng cho đặt lịch và hồ sơ tài khoản.
              </p>
            </div>
            {onAddAddress && (
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                onClick={onAddAddress}
              >
                <Plus size={16} />
                Thêm địa chỉ mới
              </button>
            )}
          </div>

          {addressError && (
            <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm font-medium text-error">
              {addressError}
            </div>
          )}

          {isAddressLoading ? (
            <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-on-surface-variant">
              Đang tải địa chỉ...
            </div>
          ) : addresses.length > 0 ? (
            <div className="space-y-3">
              {addresses.map((address) => (
                <AddressRow
                  key={address.id}
                  address={address}
                  disabled={isAddressSaving}
                  onEdit={onEditAddress}
                  onDelete={
                    onDeleteAddress
                      ? (item) => {
                          void handleDeleteAddress(item);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-on-surface-variant">
              Chưa có địa chỉ đã lưu.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
