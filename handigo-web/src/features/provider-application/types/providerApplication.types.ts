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
export type OcrDocumentKind =
  | 'cccd_front'
  | 'cccd_back'
  | 'passport'
  | 'certificate';

export interface ProviderApplicationOcrSuggestion {
  documentNumber?: string;
  fullName?: string;
  issuedPlace?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  nationality?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  title?: string;
  certificateNumber?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  confidence?: number;
  warnings: string[];
}

export interface ProviderApplicationAssetUpload {
  url: string;
  ocrSuggestion?: ProviderApplicationOcrSuggestion;
}

export interface ProviderApplicationIdentityDocument {
  type: IdentityDocumentType;
  documentNumber: string;
  numberLast4?: string;
  fullName: string;
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

export interface ProviderApplicationPayload {
  applicationType?: 'initial';
  description: string;
  experienceYears: number;
  serviceIds: string[];
  workingAreas: string[];
  identityDocument: ProviderApplicationIdentityDocument;
  certificates: ProviderApplicationCertificate[];
}

export interface ProviderApplication
  extends Omit<ProviderApplicationPayload, 'serviceIds' | 'applicationType'> {
  _id: string;
  applicationType: 'initial' | 'service_addition';
  status: 'draft' | 'pending' | 'resubmitted' | 'approved' | 'rejected';
  serviceIds: Array<string | Service>;
  rejectionReason?: string | null;
  rejectionNotes?: string | null;
  reviewedBy?: ApplicationActor | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  resubmittedAt?: string | null;
  updatedAt: string;
  reviewHistory?: ProviderApplicationReviewHistory[];
  createdAt: string;
}

export type ProviderApplicationDraftPayload = ProviderApplicationPayload & {
  onboardingStep?: 1 | 2 | 3;
};

export interface ServiceAdditionApplicationPayload {
  applicationType: 'service_addition';
  description?: string;
  experienceYears?: number;
  serviceIds: string[];
  certificates: ProviderApplicationCertificate[];
}

export interface ApplicationActor {
  _id: string;
  fullName: string;
  email?: string;
  role?: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
}

export interface ProviderApplicationReviewHistory {
  action: 'submitted' | 'rejected' | 'resubmitted' | 'approved';
  status: ProviderApplication['status'];
  actorId: ApplicationActor | string | null;
  actorRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  occurredAt: string;
  rejectionReason?: string | null;
  notes?: string | null;
}

export interface ProviderApplicationListResult {
  items: ProviderApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
