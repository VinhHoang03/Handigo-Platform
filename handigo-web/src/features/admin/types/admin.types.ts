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
export interface AdminApplication {
  _id: string; userId: ApplicationUser; description: string; experienceYears: number;
  serviceIds: ServiceRef[]; workingAreas: string[];
  status: 'pending' | 'approved' | 'rejected'; rejectionReason?: string | null; createdAt: string;
}
export interface ListResult<T> { items: T[]; pagination: Pagination }
export interface AdminQuery { page?: number; limit?: number; keyword?: string; role?: string; status?: string; categoryId?: string }
