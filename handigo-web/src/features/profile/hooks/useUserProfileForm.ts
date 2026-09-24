import { useState, type FormEvent } from "react";
import type {
  UserAddress,
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";
import { getErrorMessage } from "@/utils/apiError";
import {
  isValidVietnamesePhone,
  normalizeVietnamesePhone,
} from "@/utils/phoneValidation";
import {
  getTodayDate,
  toProfileForm,
  type ProfileFieldErrors,
} from "@/features/profile/utils/userProfileForm.utils";

interface UseUserProfileFormOptions {
  user: UserProfileData;
  showAvatar: boolean;
  onSaveProfile: (payload: UserProfileFormValue) => Promise<void> | void;
  onSaveAvatar?: (url: string) => Promise<void> | void;
  onDeleteAddress?: (address: UserAddress) => Promise<void> | void;
}

/** State + hành vi chỉnh sửa hồ sơ cá nhân: bật/tắt sửa, validate, lưu avatar, xoá địa chỉ. */
export function useUserProfileForm({
  user,
  showAvatar,
  onSaveProfile,
  onSaveAvatar,
  onDeleteAddress,
}: UseUserProfileFormOptions) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEmailVisible, setIsEmailVisible] = useState(false);
  const [profileForm, setProfileForm] = useState<UserProfileFormValue>(() =>
    toProfileForm(user),
  );
  const [localProfileError, setLocalProfileError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});

  const startEditing = () => {
    setProfileForm(toProfileForm(user));
    setLocalProfileError("");
    setFieldErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setProfileForm(toProfileForm(user));
    setLocalProfileError("");
    setFieldErrors({});
    setIsEditing(false);
  };

  const updateField = <K extends keyof UserProfileFormValue>(
    field: K,
    value: UserProfileFormValue[K],
  ) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalProfileError("");
    setFieldErrors({});

    const normalizedName = profileForm.fullName.trim().replace(/\s+/g, " ");
    const normalizedPhone = normalizeVietnamesePhone(profileForm.phone || "");
    const nextFieldErrors: ProfileFieldErrors = {};

    if (!normalizedName) {
      nextFieldErrors.fullName = "Vui lòng nhập họ và tên.";
    } else if (!/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(normalizedName)) {
      nextFieldErrors.fullName =
        "Họ và tên chỉ được chứa chữ cái và khoảng trắng.";
    }

    if (normalizedPhone && !isValidVietnamesePhone(normalizedPhone)) {
      nextFieldErrors.phone = "Số điện thoại Việt Nam không hợp lệ.";
    }

    if (profileForm.birthday && profileForm.birthday > getTodayDate()) {
      nextFieldErrors.birthday = "Ngày sinh không được sau ngày hiện tại.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    try {
      await onSaveProfile({
        fullName: normalizedName,
        phone: normalizedPhone || undefined,
        avatar: showAvatar
          ? profileForm.avatar?.trim() || null
          : user.avatar || null,
        birthday: profileForm.birthday || null,
        gender: profileForm.gender || null,
      });
      setIsEditing(false);
    } catch (saveError) {
      const message = getErrorMessage(
        saveError,
        "Không thể cập nhật hồ sơ. Vui lòng thử lại.",
      );
      if (message.toLowerCase().includes("số điện thoại")) {
        setFieldErrors((current) => ({ ...current, phone: message }));
      } else {
        setLocalProfileError(message);
      }
    }
  };

  const handleAvatarSave = async (url: string) => {
    if (onSaveAvatar) {
      await onSaveAvatar(url);
    } else {
      await onSaveProfile({ ...toProfileForm(user), avatar: url });
    }
    setProfileForm((current) => ({ ...current, avatar: url }));
  };

  const handleDeleteAddress = async (address: UserAddress) => {
    const confirmed = window.confirm(`Xóa địa chỉ "${address.fullAddress}"?`);
    if (!confirmed) return;
    await onDeleteAddress?.(address);
  };

  return {
    isEditing,
    isEmailVisible,
    setIsEmailVisible,
    profileForm,
    localProfileError,
    fieldErrors,
    startEditing,
    cancelEditing,
    updateField,
    handleProfileSubmit,
    handleAvatarSave,
    handleDeleteAddress,
  };
}
