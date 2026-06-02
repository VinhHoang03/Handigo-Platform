export interface Booking {
  id: string;
  title: string;
  providerName?: string;
  status: 'Confirmed' | 'Pending' | 'Cancelled' | 'Đã xác nhận' | 'Đang chờ' | 'Đã hủy';
  date: string;
  time: string;
  price: string;
  imageUrl: string;
}

export interface Pro {
  id: string;
  name: string;
  title: string;
  rating: number;
  reviewsCount: number;
  avatarUrl: string;
}

export interface Category {
  icon: string;
  name: string;
}

export interface Address {
  id: string;
  type?: 'home' | 'office' | 'other';
  label: string;
  addressLine: string;
  ward: string;
  district: string;
  city: string;
  isDefault?: boolean;
  address?: string;
}

export interface CreateAddressPayload {
  label: string;
  addressLine: string;
  ward: string;
  district: string;
  city: string;
  isDefault?: boolean;
}

export interface UserProfile {
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  role?: string;
  status?: string;
  isEmailVerified?: boolean;
  joinDate?: string;  // derived from createdAt
  avatarUrl?: string; // alias for avatar, used in UI
}
