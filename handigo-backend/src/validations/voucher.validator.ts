import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

export const applyVoucherSchema = z.object({
  orderId: objectIdSchema,
  code: z.string().trim().min(1, "Mã voucher là bắt buộc").max(50, "Mã voucher không hợp lệ"),
});

export const removeVoucherSchema = z.object({
  orderId: objectIdSchema,
});

export const availableVoucherQuerySchema = z.object({
  orderId: objectIdSchema.optional(),
});

const discountTypeSchema = z.enum(["PERCENT", "AMOUNT"]);

const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Thời gian không hợp lệ",
});

const positiveNumberSchema = z.coerce.number().min(0);

const adminVoucherBaseSchema = z.object({
  code: z.string().trim().min(1, "Ma voucher la bat buoc").max(50).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  discountType: discountTypeSchema,
  discountValue: z.coerce.number().positive("Gia tri giam gia phai lon hon 0"),
  maxDiscountAmount: positiveNumberSchema.nullable().optional(),
  minOrderAmount: positiveNumberSchema.nullable().optional(),
  usageLimit: z.coerce.number().int().min(0).nullable().optional(),
  startAt: dateStringSchema,
  endAt: dateStringSchema,
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const createAdminVoucherSchema = adminVoucherBaseSchema
  .superRefine((data, ctx) => {
    if (data.discountType === "PERCENT" && (data.discountValue < 1 || data.discountValue > 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Gia tri phan tram phai tu 1 den 100",
      });
    }

    if (new Date(data.startAt) >= new Date(data.endAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "startAt phai truoc endAt",
      });
    }
  });

export const updateAdminVoucherSchema = adminVoucherBaseSchema
  .omit({ code: true, discountType: true, discountValue: true, startAt: true, endAt: true })
  .extend({
    code: z.string().trim().min(1).max(50).transform((value) => value.toUpperCase()).optional(),
    discountType: discountTypeSchema.optional(),
    discountValue: z.coerce.number().positive("Gia tri giam gia phai lon hon 0").optional(),
    startAt: dateStringSchema.optional(),
    endAt: dateStringSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "PERCENT" && data.discountValue !== undefined && (data.discountValue < 1 || data.discountValue > 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Gia tri phan tram phai tu 1 den 100",
      });
    }

    if (data.startAt && data.endAt && new Date(data.startAt) >= new Date(data.endAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "startAt phai truoc endAt",
      });
    }
  });

export const adminVoucherQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "EXPIRED", "active", "inactive", "expired"]).optional(),
});

export const voucherIdParamSchema = z.object({
  id: objectIdSchema,
});

export type ApplyVoucherInput = z.infer<typeof applyVoucherSchema>;
export type RemoveVoucherInput = z.infer<typeof removeVoucherSchema>;
export type AvailableVoucherQuery = z.infer<typeof availableVoucherQuerySchema>;
export type CreateAdminVoucherInput = z.infer<typeof createAdminVoucherSchema>;
export type UpdateAdminVoucherInput = z.infer<typeof updateAdminVoucherSchema>;
export type AdminVoucherQuery = z.infer<typeof adminVoucherQuerySchema>;
