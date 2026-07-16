import { z } from "zod";
import { personNameSchema, vietnamesePhoneSchema } from "./user.validator";

const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);
const administrativeCodeSchema = z.number().int().positive();

export const addressIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID địa chỉ không hợp lệ"),
});

export const createAddressSchema = z.object({
  recipientName: personNameSchema,
  recipientPhone: vietnamesePhoneSchema,
  fullAddress: z
    .string()
    .trim()
    .min(5, "Địa chỉ phải có ít nhất 5 ký tự")
    .max(500, "Địa chỉ không được vượt quá 500 ký tự"),

  province: z
    .string()
    .trim()
    .min(1, "Tỉnh hoặc thành phố là bắt buộc")
    .max(120),

  provinceCode: administrativeCodeSchema.optional(),

  ward: z
    .string()
    .trim()
    .min(1, "Phường hoặc xã là bắt buộc")
    .max(120),

  wardCode: administrativeCodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  placeId: z.string().trim().max(255).optional(),
  isDefault: z.boolean().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const updateAddressSchema = z.object({
  recipientName: personNameSchema.optional(),
  recipientPhone: vietnamesePhoneSchema.optional(),
  fullAddress: z
    .string()
    .trim()
    .min(5)
    .max(500)
    .optional(),

  province: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),

  provinceCode: administrativeCodeSchema.optional(),

  ward: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),

  wardCode: administrativeCodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  placeId: z.string().trim().max(255).optional(),
  isDefault: z.boolean().optional(),
  note: z.string().trim().max(500).nullable().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "Cần cung cấp ít nhất một trường để cập nhật địa chỉ",
});

export const mapAddressCandidateSchema = z.object({
  fullAddress: z
    .string()
    .trim()
    .min(5, "Địa chỉ phải có ít nhất 5 ký tự")
    .max(500, "Địa chỉ không được vượt quá 500 ký tự"),
  province: z
    .string()
    .trim()
    .min(1, "Vui lòng chọn tỉnh hoặc thành phố")
    .max(120),
  provinceCode: administrativeCodeSchema.optional(),
  ward: z
    .string()
    .trim()
    .min(1, "Vui lòng chọn phường hoặc xã")
    .max(120),
  wardCode: administrativeCodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  placeId: z.string().trim().max(255).optional(),
});
