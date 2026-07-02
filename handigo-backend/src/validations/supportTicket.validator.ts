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

export const updateSupportTicketStatusSchema = z.object({
  status: z.enum(SUPPORT_TICKET_STATUSES),
  resolutionNote: z.string().trim().max(3000).nullable().optional(),
});

export const assignSupportTicketSchema = z.object({
  assignedAdminId: objectIdSchema.nullable().optional(),
});

export const supportTicketIdSchema = z.object({
  id: objectIdSchema,
});
