import { z } from "zod";
import { personNameSchema, vietnamesePhoneSchema } from "./user.validator";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long");

export const registerSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: passwordSchema,
  fullName: personNameSchema,
  phone: z.preprocess(
    (value) => typeof value === "string" && !value.trim() ? undefined : value,
    vietnamesePhoneSchema.optional(),
  ),
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

export const googleLoginSchema = z
  .object({
    credential: z.string().trim().min(1, "Google credential is required").optional(),
    accessToken: z.string().trim().min(1, "Google access token is required").optional(),
  })
  .refine((data) => Boolean(data.credential || data.accessToken), {
    message: "Google credential or access token is required",
    path: ["credential"],
  });

export const facebookLoginSchema = z.object({
  accessToken: z.string().trim().min(1, "Facebook access token is required"),
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
