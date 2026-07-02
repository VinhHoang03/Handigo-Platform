import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "ORDER",
  "PAYMENT",
  "QUOTATION",
  "WITHDRAWAL",
  "PROMOTION",
  "SYSTEM",
]);

export const targetRoleSchema = z.enum(["CUSTOMER", "PROVIDER", "ALL"]);

export const notificationIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"),
});

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  isRead: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === "true";
    }),
  type: notificationTypeSchema.optional(),
});

export const adminNotificationListQuerySchema = notificationListQuerySchema.extend({
  targetRole: targetRoleSchema.optional(),
});

export const sendSystemNotificationSchema = z.object({
  targetRole: targetRoleSchema,
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required").max(2000),
  type: z.literal("SYSTEM").default("SYSTEM"),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type AdminNotificationListQuery = z.infer<typeof adminNotificationListQuerySchema>;
export type SendSystemNotificationInput = z.infer<typeof sendSystemNotificationSchema>;
