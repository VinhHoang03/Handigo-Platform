import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long");

export const registerSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: passwordSchema,
  fullName: z.string().trim().min(2, "Full name is required"),
  phone: z.string().trim().optional(),
});

export const verifyRegisterOtpSchema = z.object({
  email: z.email().trim().toLowerCase(),
  otp: z.string().trim().length(6, "OTP must be 6 digits"),
});

export const resendRegisterOtpSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
  otp: z.string().trim().length(6, "OTP must be 6 digits"),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});
