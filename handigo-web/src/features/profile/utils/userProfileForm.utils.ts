import type {
  GenderValue,
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";

export const genderLabels: Record<GenderValue, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

export const toDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const getTodayDate = () => {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

export const toProfileForm = (user: UserProfileData): UserProfileFormValue => ({
  fullName: user.fullName || "",
  phone: user.phone || "",
  avatar: user.avatar || user.avatarUrl || "",
  birthday: toDateInput(user.birthday),
  gender: user.gender || null,
});

export const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
};

export const maskEmail = (email?: string | null) => {
  if (!email) return "Chưa cập nhật";
  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  const visibleLength = Math.min(3, Math.max(1, localPart.length));
  return `${localPart.slice(0, visibleLength)}******@${domain}`;
};

export interface ProfileFieldErrors {
  fullName?: string;
  phone?: string;
  birthday?: string;
}
