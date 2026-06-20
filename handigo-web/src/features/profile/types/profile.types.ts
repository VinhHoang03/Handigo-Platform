export type GenderValue = "male" | "female" | "other";

export interface UserProfileData {
  id?: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  birthday?: string | null;
  gender?: GenderValue | null;
  role?: string;
  status?: string;
  isEmailVerified?: boolean;
  createdAt?: string;
  joinDate?: string;
  avatarUrl?: string;
}

export interface UserProfileFormValue {
  fullName: string;
  phone?: string;
  avatar?: string | null;
  birthday?: string | null;
  gender?: GenderValue | null;
}

export interface UserAddress {
  id: string;
  recipientName?: string;
  recipientPhone?: string;
  fullAddress: string;
  province: string;
  provinceCode?: number;
  ward: string;
  wardCode?: number;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault?: boolean;
  note?: string | null;
}

export interface UserAddressPayload {
  recipientName: string;
  recipientPhone: string;
  fullAddress: string;
  province: string;
  provinceCode?: number;
  ward: string;
  wardCode?: number;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault?: boolean;
  note?: string | null;
}
