import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Id không hợp lệ");

const penaltySchema = z.object({
  type: z.enum([
    "WARNING",
    "TEMPORARY_SUSPEND",
    "PERMANENT_BAN",
    "RESTRICT_FEATURE",
    "RESTRICT_ORDER_RECEIVING",
    "RESTRICT_CHAT",
    "RESTRICT_VOUCHER",
  ]),
  feature: z.string().trim().max(100).nullable().optional(),
  durationDays: z.number().int().min(1).max(3650).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const createViolationSchema = z
  .object({
    userId: objectIdSchema.optional(),
    sourceType: z.enum(["REPORT", "COMPLAINT", "SUPPORT_TICKET"]),
    sourceId: objectIdSchema,
    orderId: objectIdSchema.optional(),
    violationType: z.string().trim().min(2).max(100),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    reason: z.string().trim().min(5).max(3000),
    adminDecision: z.string().trim().min(5).max(3000),
    penalty: penaltySchema,
  })
  .refine(
    (data) => data.penalty.type !== "TEMPORARY_SUSPEND" || Boolean(data.penalty.durationDays),
    "Cần nhập thời hạn khi tạm khóa tài khoản",
  );

export const violationIdSchema = z.object({
  id: objectIdSchema,
});

export const violationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["active", "resolved"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  sourceType: z.enum(["REPORT", "COMPLAINT", "SUPPORT_TICKET"]).optional(),
  userId: objectIdSchema.optional(),
});
