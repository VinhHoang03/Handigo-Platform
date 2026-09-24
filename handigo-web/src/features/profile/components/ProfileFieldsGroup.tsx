import { Eye, EyeOff } from "lucide-react";
import type {
  GenderValue,
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";
import type { ProfileFieldErrors } from "@/features/profile/utils/userProfileForm.utils";
import {
  formatDate,
  genderLabels,
  getTodayDate,
  maskEmail,
} from "@/features/profile/utils/userProfileForm.utils";
import { ProfileDisplayField } from "./ProfileDisplayField";
import { ProfileTextField } from "./ProfileTextField";

interface ProfileFieldsGroupProps {
  isEditing: boolean;
  user: UserProfileData;
  profileForm: UserProfileFormValue;
  fieldErrors: ProfileFieldErrors;
  highlightPhone?: boolean;
  isEmailVisible: boolean;
  onToggleEmailVisible: () => void;
  onFieldChange: <K extends keyof UserProfileFormValue>(
    field: K,
    value: UserProfileFormValue[K],
  ) => void;
}

export function ProfileFieldsGroup({
  isEditing,
  user,
  profileForm,
  fieldErrors,
  highlightPhone,
  isEmailVisible,
  onToggleEmailVisible,
  onFieldChange,
}: ProfileFieldsGroupProps) {
  return (
    <div className="space-y-4">
      {isEditing ? (
        <>
          <ProfileTextField
            id="user-profile-full-name"
            label="Họ và tên"
            value={profileForm.fullName}
            required
            error={fieldErrors.fullName}
            onChange={(value) => onFieldChange("fullName", value)}
          />
          <ProfileTextField
            id="user-profile-phone"
            label="Số điện thoại"
            type="tel"
            value={profileForm.phone || ""}
            highlighted={highlightPhone}
            error={fieldErrors.phone}
            onChange={(value) => onFieldChange("phone", value)}
          />
          <label className="block space-y-2">
            <span className="block text-xs font-bold uppercase text-on-surface-variant">
              Giới tính
            </span>
            <select
              id="user-profile-gender"
              value={profileForm.gender || ""}
              onChange={(event) =>
                onFieldChange(
                  "gender",
                  (event.target.value || null) as GenderValue | null,
                )
              }
              className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Chưa cập nhật</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <ProfileTextField
            id="user-profile-birthday"
            label="Ngày sinh"
            type="date"
            value={profileForm.birthday || ""}
            max={getTodayDate()}
            error={fieldErrors.birthday}
            onChange={(value) => onFieldChange("birthday", value)}
          />
        </>
      ) : (
        <>
          <ProfileDisplayField label="Họ và tên" value={user.fullName} />
          <ProfileDisplayField
            label="Số điện thoại"
            value={user.phone || ""}
            highlighted={highlightPhone}
          />
          <ProfileDisplayField
            label="Giới tính"
            value={user.gender ? genderLabels[user.gender] : ""}
          />
          <ProfileDisplayField
            label="Ngày sinh"
            value={formatDate(user.birthday)}
          />
        </>
      )}

      <ProfileDisplayField
        label="Email"
        value={isEmailVisible ? user.email : maskEmail(user.email)}
        action={
          <button
            type="button"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface hover:text-primary"
            title={isEmailVisible ? "Ẩn email" : "Hiện email"}
            aria-label={isEmailVisible ? "Ẩn email" : "Hiện email"}
            onClick={onToggleEmailVisible}
          >
            {isEmailVisible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        }
      />
    </div>
  );
}
