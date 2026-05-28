export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'provider' | 'CUSTOMER' | 'PROVIDER';
  avatarUrl?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

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
