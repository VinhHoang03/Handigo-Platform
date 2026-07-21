import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

const dateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Ngày không hợp lệ",
  });

export const createServiceSuggestionSchema = z.object({
  suggestionType: z.enum(["service", "category"]).default("service"),
  suggestedServiceName: z.string().trim().min(1).max(120).optional().nullable(),
  suggestedCategoryName: z.string().trim().min(1).max(120).optional().nullable(),
  categoryId: objectIdSchema.optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.suggestionType === "service" && !data.suggestedServiceName) {
    ctx.addIssue({
      code: "custom",
      path: ["suggestedServiceName"],
      message: "Tên dịch vụ đề xuất là bắt buộc",
    });
  }

  if (data.suggestionType === "category" && !data.suggestedCategoryName) {
    ctx.addIssue({
      code: "custom",
      path: ["suggestedCategoryName"],
      message: "Tên danh mục đề xuất là bắt buộc",
    });
  }
});

export const updateServiceSuggestionSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  adminNote: z.string().trim().max(2000).optional().nullable(),
  categoryId: objectIdSchema.optional().nullable(),
  createdServiceId: objectIdSchema.optional().nullable(),
  createdCategoryId: objectIdSchema.optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Cần cung cấp ít nhất một trường để cập nhật",
});

export const listServiceSuggestionSchema = z.object({
  status: z
    .union([z.enum(["pending", "approved", "rejected"]), z.literal("")])
    .optional()
    .transform((value) => value || undefined),
  suggestionType: z
    .union([z.enum(["service", "category"]), z.literal("")])
    .optional()
    .transform((value) => value || undefined),
  providerId: objectIdSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).refine(
  (query) =>
    !query.startDate ||
    !query.endDate ||
    new Date(query.startDate) <= new Date(query.endDate),
  {
    path: ["endDate"],
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi",
  },
);

export type CreateServiceSuggestionPayload = z.infer<
  typeof createServiceSuggestionSchema
>;
export type UpdateServiceSuggestionPayload = z.infer<
  typeof updateServiceSuggestionSchema
>;
export type ListServiceSuggestionQuery = z.infer<
  typeof listServiceSuggestionSchema
>;
