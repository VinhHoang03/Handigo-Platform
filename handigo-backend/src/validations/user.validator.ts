import { z } from "zod";
import {
  isValidPersonName,
  isValidVietnamesePhone,
  normalizePersonName,
  normalizeVietnamesePhone,
} from "../utils/profileValidation";

export const personNameSchema = z.string().transform(normalizePersonName).pipe(
  z.string()
    .min(2, "Họ và tên phải có ít nhất 2 ký tự")
    .max(120, "Họ và tên không được vượt quá 120 ký tự")
    .refine(isValidPersonName, {
      message: "Họ và tên chỉ được chứa chữ cái và khoảng trắng",
    }),
);

export const vietnamesePhoneSchema = z.string().transform(normalizeVietnamesePhone).pipe(
  z.string().refine(isValidVietnamesePhone, {
    message: "Số điện thoại Việt Nam không hợp lệ",
  }),
);

export const updateUserProfileSchema = z.object({
  fullName: personNameSchema.optional(),
  phone: vietnamesePhoneSchema.optional(),
  avatar: z.string().trim().max(2000).nullable().optional(),
  birthday: z
    .union([z.string().trim(), z.date()])
    .nullable()
    .optional()
    .refine(
      (value) => value === undefined || value === null || !Number.isNaN(new Date(value).getTime()),
      "Ngày sinh không hợp lệ",
    )
    .refine(
      (value) =>
        value === undefined ||
        value === null ||
        new Date(value).getTime() <= Date.now(),
      "Ngày sinh không được sau ngày hiện tại",
    ),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "Cần cung cấp ít nhất một trường để cập nhật hồ sơ",
});

export type UpdateUserProfilePayload = z.infer<typeof updateUserProfileSchema>;
