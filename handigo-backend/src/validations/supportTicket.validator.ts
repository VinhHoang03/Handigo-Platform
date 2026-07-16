import { z } from "zod";
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
} from "../models/supportTicket.model";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Id không hợp lệ");

const urlSchema = z.string().trim().url("Đường dẫn tệp không hợp lệ");

const attachmentSchema = z.object({
  fileType: z.enum(["image", "video", "file"]),
  url: urlSchema,
  mimeType: z.string().trim().max(100).nullable().optional(),
  fileName: z.string().trim().max(255).nullable().optional(),
});

export const createSupportTicketSchema = z.object({
  orderId: objectIdSchema.nullable().optional(),
  category: z.enum(SUPPORT_TICKET_CATEGORIES),
  priority: z.enum(SUPPORT_TICKET_PRIORITIES).optional(),
  subject: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(3000),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const addSupportTicketResponseSchema = z.object({
  message: z.string().trim().min(1).max(3000),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const updateSupportTicketStatusSchema = z
  .object({
    status: z.enum(SUPPORT_TICKET_STATUSES),
    resolutionNote: z.string().trim().max(3000).nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.status === "resolved" && (!payload.resolutionNote || payload.resolutionNote.length < 10)) {
      ctx.addIssue({
        code: "custom",
        path: ["resolutionNote"],
        message: "Ghi chú xử lý phải có ít nhất 10 ký tự khi hoàn tất yêu cầu",
      });
    }
  });

export const assignSupportTicketSchema = z.object({
  assignedAdminId: objectIdSchema.nullable().optional(),
});

export const supportTicketIdSchema = z.object({
  id: objectIdSchema,
});

export const supportTicketListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
  category: z.enum(SUPPORT_TICKET_CATEGORIES).optional(),
  priority: z.enum(SUPPORT_TICKET_PRIORITIES).optional(),
  keyword: z.string().trim().max(100).optional(),
  assignedAdminId: objectIdSchema.optional(),
  assignment: z.enum(["assigned", "unassigned"]).optional(),
});
