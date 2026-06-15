export interface Category { _id: string; name: string; slug: string; icon?: string }
export interface ProviderApplicationPayload {
  description: string;
  experienceYears: number;
  serviceCategoryIds: string[];
  workingAreas: string[];
}
export interface ProviderApplication extends ProviderApplicationPayload {
  _id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  createdAt: string;
}
