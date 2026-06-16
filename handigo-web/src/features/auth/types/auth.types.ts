export interface User {
  id: string;
  _id?: string;
  email: string;
  fullName: string;
  role: 'customer' | 'provider' | 'admin' | 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  phone?: string;
  avatar?: string | null;
  status?: 'active' | 'locked';
  isEmailVerified?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type GoogleLoginRequest =
  | { credential: string }
  | { accessToken: string };

export interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
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
