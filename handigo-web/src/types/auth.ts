export interface AuthUser {
  _id?: string;
  id?: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatar?: string | null;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
  isEmailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileUpdateInput {
  fullName: string;
  phone?: string;
  avatar?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
