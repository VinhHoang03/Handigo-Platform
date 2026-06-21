export interface Job {
  id: string;
  title: string;
  address: string;
  startTime: string;
  endTime: string;
  status:
    | 'Active'
    | 'Confirmed'
    | 'Pending'
    | 'Đang hoạt động'
    | 'Đã xác nhận'
    | 'Đang chờ';
}

export interface ProviderStats {
  dailyEarnings: string;
  availableBalance: string;
  weeklyEarnings: string;
}

export type Gender = 'male' | 'female' | 'other';
export type IdentityDocumentType = 'cccd' | 'passport';
export type VerificationStatus =
  | 'unsubmitted'
  | 'pending'
  | 'verified'
  | 'rejected';
export type IdentityVerificationProvider =
  | 'manual'
  | 'fpt'
  | 'vnpt'
  | 'viettel'
  | 'didit';
export type CertificateStatus = 'pending' | 'approved' | 'rejected';

export interface ProviderServiceArea {
  province?: string;
  ward?: string;
}

export interface ProviderServiceRef {
  id: string;
  name: string;
  slug?: string;
}

export interface IdentityDocument {
  type?: IdentityDocumentType;
  documentNumber?: string;
  numberLast4?: string;
  fullName?: string;
  issuedPlace?: string;
  issuedAt?: string;
  expiresAt?: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  passportImageUrl?: string;
  selfieImageUrl?: string;
  verificationStatus: VerificationStatus;
  provider?: IdentityVerificationProvider;
  submittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string | null;
}

export interface SubmitIdentityPayload {
  type: IdentityDocumentType;
  documentNumber?: string;
  numberLast4?: string;
  fullName?: string;
  issuedPlace?: string;
  issuedAt?: string;
  expiresAt?: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  passportImageUrl?: string;
  selfieImageUrl?: string;
  consentAccepted: boolean;
}

export interface ProviderCertificate {
  id: string;
  title: string;
  certificateNumber?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  imageUrls: string[];
  description?: string;
  status: CertificateStatus;
  reviewedAt?: string;
  rejectionReason?: string | null;
}

export interface UpsertCertificatePayload {
  title: string;
  certificateNumber?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  imageUrls: string[];
  description?: string;
}

export interface UpdateProviderProfilePayload {
  fullName?: string;
  phone?: string;
  avatar?: string | null;
  birthday?: string | null;
  gender?: Gender | null;
  description?: string;
  bio?: string;
  mainServiceText?: string;
  serviceArea?: ProviderServiceArea;
  serviceIds?: string[];
  workingAreas?: string[];
}

export interface ProviderProfileResponse {
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    avatar?: string | null;
    birthday?: string | null;
    gender?: Gender | null;
    createdAt?: string;
  };
  provider: {
    id: string;
    description: string;
    bio?: string;
    mainServiceText?: string;
    experienceYears: number;
    availabilityStatus: 'online' | 'offline' | 'busy';
    verified: boolean;
    serviceIds: string[];
    services?: ProviderServiceRef[];
    workingAreas: string[];
    serviceArea?: ProviderServiceArea;
    averageRating: number;
    totalFeedbacks: number;
    totalCompletedOrders: number;
    identityDocument?: IdentityDocument;
    certificates: ProviderCertificate[];
  };
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
  statusTone: 'approved' | 'pending' | 'rejected';
}

export interface ServiceArea {
  province?: string;
  ward?: string;
  workingAreas?: string[];
}

export interface BankAccount {
  shortName: string;
  bankName: string;
  maskedNumber: string;
}
