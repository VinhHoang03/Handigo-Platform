import { z } from "zod";
import { REPORT_TARGET_TYPES, REPORT_TYPES, REPORT_STATUSES } from "../models/report.model";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Id không hợp lệ");

const urlSchema = z.string().trim().url("Đường dẫn tệp không hợp lệ");

const evidenceFileSchema = z.object({
  fileType: z.enum(["image", "video", "file"]),
  url: urlSchema,
  mimeType: z.string().trim().max(100).nullable().optional(),
  fileName: z.string().trim().max(255).nullable().optional(),
});

export const createReportSchema = z
  .object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetUserId: objectIdSchema.optional(),
    targetProviderId: objectIdSchema.optional(),
    orderId: objectIdSchema.optional(),
    targetFeedbackId: objectIdSchema.optional(),
    conversationId: objectIdSchema.optional(),
    reportType: z.enum(REPORT_TYPES),
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().min(10).max(3000),
    evidenceImages: z.array(urlSchema).max(10).optional(),
    evidenceFiles: z.array(evidenceFileSchema).max(10).optional(),
  })
  .refine(
    (data) => {
      if (data.targetType === "user") return Boolean(data.targetUserId);
      if (data.targetType === "provider") return Boolean(data.targetUserId || data.targetProviderId);
      if (data.targetType === "order") return Boolean(data.orderId);
      if (data.targetType === "feedback") return Boolean(data.targetFeedbackId);
      if (data.targetType === "chat_conversation") return Boolean(data.conversationId);
      return true;
    },
    "Thiếu thông tin đối tượng bị báo cáo",
  );

export const reviewReportSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  reviewNote: z.string().trim().max(3000).nullable().optional(),
  resolutionNote: z.string().trim().max(3000).nullable().optional(),
});

export const reportIdSchema = z.object({
  id: objectIdSchema,
});

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(REPORT_STATUSES).optional(),
  reportType: z.enum(REPORT_TYPES).optional(),
  targetType: z.enum(REPORT_TARGET_TYPES).optional(),
  keyword: z.string().trim().max(100).optional(),
});
