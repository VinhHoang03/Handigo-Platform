import { z } from "zod";

export const updateUserStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("active") }),
  z.object({
    status: z.literal("locked"),
    reason: z.string().trim().min(5, "Lý do vi phạm phải có ít nhất 5 ký tự").max(3000),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    penaltyType: z.enum(["TEMPORARY_SUSPEND", "PERMANENT_BAN"]),
    durationDays: z.number().int().min(1).max(3650).optional(),
    duration: z.number().int().min(1).max(87600).optional(),
    durationUnit: z.enum(["hours", "days"]).optional(),
  }).superRefine((value, context) => {
    const hasDuration = value.duration !== undefined || value.durationUnit !== undefined;
    if (value.penaltyType === "PERMANENT_BAN") {
      if (hasDuration || value.durationDays !== undefined) context.addIssue({ code: "custom", path: ["duration"], message: "Khóa vĩnh viễn không có thời hạn" });
      return;
    }
    if (hasDuration) {
      if (!value.duration || !value.durationUnit || value.durationDays !== undefined) {
        context.addIssue({ code: "custom", path: ["duration"], message: "Cần nhập thời hạn và chọn Giờ hoặc Ngày; không gửi kèm thời hạn cũ" });
      } else if (value.durationUnit === "days" && value.duration > 3650) {
        context.addIssue({ code: "custom", path: ["duration"], message: "Thời hạn tối đa là 3650 ngày" });
      }
    } else if (!value.durationDays) context.addIssue({ code: "custom", path: ["duration"], message: "Cần nhập thời hạn tạm khóa" });
  }),
]);

export type UpdateUserStatusPayload = z.infer<typeof updateUserStatusSchema>;

export const adminEntityIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"),
});

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  keyword: z.string().trim().max(100).optional(),
  role: z.enum(["CUSTOMER", "PROVIDER", "ADMIN"]).optional(),
  status: z.enum(["active", "locked"]).optional(),
});

export {
  providerApplicationIdParamSchema,
  providerApplicationListQuerySchema,
  reviewProviderApplicationSchema,
} from "./providerApplication.validator";
