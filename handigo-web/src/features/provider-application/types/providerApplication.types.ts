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

export interface ProviderApplicationPayload {
  description: string;
  experienceYears: number;
  serviceIds: string[];
  workingAreas: string[];
}

export interface ProviderApplication extends ProviderApplicationPayload {
  _id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  createdAt: string;
}
