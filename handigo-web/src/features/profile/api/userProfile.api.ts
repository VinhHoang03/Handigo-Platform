import api from "@/api/client";
import type { UserProfileData, UserProfileFormValue } from "../types/profile.types";

interface BackendUser {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  birthday?: string | null;
  gender?: UserProfileData["gender"];
  role?: string;
  status?: string;
  isEmailVerified?: boolean;
  createdAt?: string;
}

const mapUser = (user: BackendUser): UserProfileData => ({
  id: user.id || user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  avatarUrl: user.avatar || undefined,
  birthday: user.birthday,
  gender: user.gender,
  role: user.role,
  status: user.status,
  isEmailVerified: user.isEmailVerified,
  createdAt: user.createdAt,
  joinDate: user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("vi-VN", {
        month: "long",
        year: "numeric",
      })
    : undefined,
});

const sanitizeProfilePayload = (data: UserProfileFormValue) => ({
  fullName: data.fullName.trim(),
  phone: data.phone?.trim() || undefined,
  avatar: data.avatar?.trim() || null,
  birthday: data.birthday || null,
  gender: data.gender || null,
});

export const getUserProfile = async (): Promise<UserProfileData> => {
  const response = await api.get<{ message: string; user: BackendUser }>("/users/me");
  return mapUser(response.data.user);
};

export const updateUserProfile = async (
  data: UserProfileFormValue,
): Promise<UserProfileData> => {
  const response = await api.put<{ message: string; data: BackendUser }>(
    "/users/profile",
    sanitizeProfilePayload(data),
  );
  return mapUser(response.data.data);
};
