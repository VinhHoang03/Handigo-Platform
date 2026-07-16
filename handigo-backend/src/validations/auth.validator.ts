import { z } from "zod";
import { personNameSchema, vietnamesePhoneSchema } from "./user.validator";

const passwordSchema = z
  .string()
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "Mật khẩu không được vượt quá 72 byte",
  });

const emailSchema = z
  .email()
  .trim()
  .toLowerCase()
  .max(254, "Email không hợp lệ");

const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Mã OTP phải gồm đúng 6 chữ số");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: personNameSchema,
  phone: z.preprocess(
    (value) => typeof value === "string" && !value.trim() ? undefined : value,
    vietnamesePhoneSchema.optional(),
  ),
});

export const verifyRegisterOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const resendRegisterOtpSchema = z.object({
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
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
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    newPassword: passwordSchema,
  })
  .refine((payload) => payload.currentPassword !== payload.newPassword, {
    path: ["newPassword"],
    message: "Mật khẩu mới phải khác mật khẩu hiện tại",
  });
