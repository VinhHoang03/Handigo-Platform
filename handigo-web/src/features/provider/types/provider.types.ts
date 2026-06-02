export interface Job {
  id: string;
  title: string;
  address: string;
  startTime: string;
  endTime: string;
  status: 'Active' | 'Confirmed' | 'Pending' | 'Đang hoạt động' | 'Đã xác nhận' | 'Đang chờ';
}

export interface ProviderStats {
  dailyEarnings: string;
  availableBalance: string;
  weeklyEarnings: string;
}

export interface Certification {
  id: string;
  title: string;
  expiryDate: string;
}

export interface ProviderProfile {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  gender: string;
  birthday: string;
  bio: string;
  mainService: string;
  experience: string;
  skills: string[];
  certifications: Certification[];
  rating: number;
  reviewCount: number;
  totalBookings: number;
  providerCode: string;
  isVerified: boolean;
  joinDate: string;
  avatarUrl: string;
}

export interface PerformanceStat {
  label: string;
  value: string;
  meta: string;
  tone?: 'success' | 'warning';
}

export interface PortfolioItem {
  id: string;
  alt: string;
  imageUrl: string;
}

export interface VerificationItem {
  label: string;
  status: string;
  statusTone: 'approved' | 'pending';
}

export interface ServiceArea {
  address: string;
  radiusKm: number;
  radiusPercent: number;
  mapImageUrl: string;
}

export interface BankAccount {
  shortName: string;
  bankName: string;
  maskedNumber: string;
}
