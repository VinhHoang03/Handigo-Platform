import { z } from "zod";

const fields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  discountType: z.enum(["AMOUNT", "PERCENT"]),
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  minOrderAmount: z.number().min(0).nullable().optional(),
  usageLimit: z.number().int().min(0).nullable().optional(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  serviceIds: z.array(z.string().regex(/^[a-fA-F0-9]{24}$/, "Mã dịch vụ không hợp lệ")).max(100).default([]),
  priority: z.number().int().min(0).default(0),
  allowVoucher: z.boolean().default(false),
};
export const promotionFieldsSchema = z.object(fields).strict();
export const createPromotionSchema = promotionFieldsSchema.superRefine((data, context) => {
  if (new Date(data.startAt) >= new Date(data.endAt)) context.addIssue({ code: "custom", path: ["endAt"], message: "Ngày kết thúc phải sau ngày bắt đầu." });
  if (data.discountType === "PERCENT" && data.discountValue > 100) context.addIssue({ code: "custom", path: ["discountValue"], message: "Mức giảm phần trăm không được vượt quá 100." });
});
export const updatePromotionSchema = promotionFieldsSchema.partial().refine(value => Object.keys(value).length > 0, "Cần cung cấp nội dung cập nhật.");
