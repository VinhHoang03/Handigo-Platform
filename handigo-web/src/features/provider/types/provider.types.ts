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
  bio: string;
  skills: string[];
  certifications: Certification[];
  rating: number;
  totalBookings: number;
  joinDate: string;
  avatarUrl: string;
}
