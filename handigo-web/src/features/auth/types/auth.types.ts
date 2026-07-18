export interface User {
  id: string;
  _id?: string;
  email: string;
  fullName: string;
  role: 'customer' | 'provider' | 'admin' | 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  phone?: string;
  avatar?: string | null;
  birthday?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  status?: 'active' | 'locked';
  isEmailVerified?: boolean;
  providerOnboardingStatus?:
    | 'PROFILE_INCOMPLETE'
    | 'PENDING_REVIEW'
    | 'REJECTED'
    | 'APPROVED'
    | null;
  providerOnboardingStep?: 1 | 2 | 3 | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export type GoogleLoginRequest =
  | { credential: string; remember?: boolean }
  | { accessToken: string; remember?: boolean };

export interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
  registrationType?: 'CUSTOMER' | 'PROVIDER';
}

export interface VerifyRegisterOtpRequest {
  email: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}
