export interface Pagination { page: number; limit: number; total: number; totalPages: number }
export interface AdminUser {
  _id: string; fullName: string; email: string; phone?: string; avatar?: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN'; status: 'active' | 'locked'; createdAt: string;
}
export interface CategoryRef { _id: string; name: string; slug?: string; icon?: string }
export interface ServiceRef {
  _id: string;
  name: string;
  slug?: string;
  categoryId?: CategoryRef;
  serviceType?: 'fixed_price' | 'variable_price';
  fixedPrice?: number | null;
  image?: string | null;
}
export interface ApplicationUser { _id: string; fullName: string; email: string; phone?: string; avatar?: string }
export type IdentityDocumentType = 'cccd' | 'passport';
export type VerificationStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected';
export type CertificateStatus = 'pending' | 'approved' | 'rejected';
export interface ApplicationIdentityDocument {
  type?: IdentityDocumentType;
  documentNumber?: string;
  numberLast4?: string;
  fullName?: string;
  issuedPlace?: string;
  issuedAt?: string;
  expiresAt?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  nationality?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  passportImageUrl?: string;
  verificationStatus?: VerificationStatus;
  provider?: 'manual' | 'fpt' | 'vnpt' | 'viettel' | 'didit';
  submittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string | null;
}
export interface ApplicationCertificate {
  _id?: string;
  id?: string;
  title: string;
  certificateNumber?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  imageUrls: string[];
  description?: string;
  status?: CertificateStatus;
  reviewedAt?: string;
  rejectionReason?: string | null;
}
export interface AdminApplication {
  _id: string; userId: ApplicationUser | null; description: string; experienceYears: number;
  applicationType: 'initial' | 'service_addition';
  serviceIds: ServiceRef[]; workingAreas: string[];
  identityDocument?: ApplicationIdentityDocument;
  certificates?: ApplicationCertificate[];
  status: 'pending' | 'resubmitted' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  rejectionNotes?: string | null;
  reviewedBy?: ApplicationUser | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  resubmittedAt?: string | null;
  reviewHistory?: Array<{
    action: 'submitted' | 'rejected' | 'resubmitted' | 'approved';
    status: 'pending' | 'resubmitted' | 'approved' | 'rejected';
    actorId: ApplicationUser | string;
    actorRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
    occurredAt: string;
    rejectionReason?: string | null;
    notes?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}
export interface ListResult<T> { items: T[]; pagination: Pagination }
export interface AdminQuery { page?: number; limit?: number; keyword?: string; role?: string; status?: string; categoryId?: string; applicationType?: string }
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';
export interface AdminWithdrawalUser { _id: string; fullName: string; email: string; phone?: string }
export interface AdminWithdrawalBankAccount {
  _id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
}
export interface AdminWithdrawal {
  _id: string;
  userId: AdminWithdrawalUser;
  amount: number;
  status: WithdrawalStatus;
  bankAccountId?: AdminWithdrawalBankAccount | string;
  adminNote?: string | null;
  reviewedBy?: AdminWithdrawalUser | string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
