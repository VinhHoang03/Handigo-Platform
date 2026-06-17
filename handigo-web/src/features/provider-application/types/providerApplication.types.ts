export interface Service {
  _id: string;
  categoryId: string;
  name: string;
  slug: string;
  serviceType: 'fixed_price' | 'variable_price';
  fixedPrice?: number | null;
  depositAmount?: number | null;
  image?: string | null;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  services?: Service[];
}

export type IdentityDocumentType = 'cccd' | 'passport';
export type IdentityVerificationStatus =
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

export interface ProviderApplicationIdentityDocument {
  type: IdentityDocumentType;
  documentNumber: string;
  numberLast4?: string;
  fullName: string;
  issuedPlace?: string;
  issuedAt?: string;
  expiresAt?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  passportImageUrl?: string;
  verificationStatus?: IdentityVerificationStatus;
  provider?: IdentityVerificationProvider;
  submittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string | null;
}

export interface ProviderApplicationCertificate {
  _id?: string;
  id?: string;
  title: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  imageUrls: string[];
  status?: CertificateStatus;
  reviewedAt?: string;
  rejectionReason?: string | null;
}

export interface ProviderApplicationPayload {
  description: string;
  experienceYears: number;
  serviceIds: string[];
  workingAreas: string[];
  identityDocument: ProviderApplicationIdentityDocument;
  certificates: ProviderApplicationCertificate[];
}

export interface ProviderApplication extends ProviderApplicationPayload {
  _id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  createdAt: string;
}
