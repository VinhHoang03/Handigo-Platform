import { z } from "zod";

const optionTypeEnum = z.enum([
  "room_count",
  "area_size",
  "package",
  "add_on",
  "other",
]);

const serviceOptionFields = {
  name: z.string().trim().min(1, "Tên tùy chọn là bắt buộc").max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  image: z.string().trim().url("Ảnh tùy chọn phải là một đường dẫn hợp lệ").max(2000).nullable().optional(),
  optionType: optionTypeEnum,
  price: z.number().nonnegative("Giá tùy chọn không được âm"),
  selectionGroup: z.string().trim().min(1, "Tên nhóm lựa chọn là bắt buộc").max(120).nullable().optional(),
  selectionMode: z.enum(["single", "multiple"]).optional(),
  sortOrder: z.number().int().nonnegative("Thứ tự hiển thị không được âm").optional(),
  isActive: z.boolean().optional(),
};

export const createServiceOptionSchema = z.object(serviceOptionFields);

export const updateServiceOptionSchema = z
  .object(serviceOptionFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
