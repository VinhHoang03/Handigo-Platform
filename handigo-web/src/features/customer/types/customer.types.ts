export interface Booking {
  id: string;
  title: string;
  providerName?: string;
  status: 'Confirmed' | 'Pending' | 'Cancelled' | 'Đã xác nhận' | 'Đang chờ' | 'Đã hủy';
  date: string;
  time: string;
  price: string;
  imageUrl?: string;
  icon?: string;
  providerAvatarUrl?: string;
  statusTone?: 'confirmed' | 'pending' | 'cancelled';
  statusLabel?: string;
}

export interface Pro {
  id: string;
  name: string;
  title: string;
  rating: number;
  reviewsCount: number;
  avatarUrl: string;
  distance?: string;
  isOnline?: boolean;
}

export interface Category {
  icon: string;
  name: string;
  imageUrl?: string;
  imageAlt?: string;
}

export interface Address {
  id: string;
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
  address?: string;
}

export interface CreateAddressPayload {
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

export interface UserProfile {
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  birthday?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  role?: string;
  status?: string;
  isEmailVerified?: boolean;
  joinDate?: string;  // derived from createdAt
  avatarUrl?: string; // alias for avatar, used in UI
}
