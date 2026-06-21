import { z } from "zod";
import { personNameSchema, vietnamesePhoneSchema } from "./user.validator";

const passwordSchema = z
  .string()
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự");

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
  otp: z.string().trim().length(6, "Mã OTP phải gồm 6 chữ số"),
});

export const resendRegisterOtpSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  remember: z.boolean().optional(),
});

export const googleLoginSchema = z
  .object({
    credential: z.string().trim().min(1, "Thiếu thông tin xác thực Google").optional(),
    accessToken: z.string().trim().min(1, "Thiếu mã truy cập Google").optional(),
    remember: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.credential || data.accessToken), {
    message: "Vui lòng cung cấp thông tin đăng nhập Google",
    path: ["credential"],
  });

export const facebookLoginSchema = z.object({
  accessToken: z.string().trim().min(1, "Thiếu mã truy cập Facebook"),
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
  otp: z.string().trim().length(6, "Mã OTP phải gồm 6 chữ số"),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
  newPassword: passwordSchema,
});
