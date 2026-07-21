import { z } from "zod";
import { COMPLAINT_STATUSES } from "../models/complaint.model";

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

export const createComplaintSchema = z.object({
  orderId: objectIdSchema,
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(3000),
  evidenceImages: z.array(urlSchema).max(10).optional(),
});

export const addComplaintEvidenceSchema = z.object({
  files: z.array(evidenceFileSchema).min(1).max(10),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  resolutionNote: z.string().trim().max(3000).nullable().optional(),
});

export const requestComplaintEvidenceSchema = z.object({
  requestedEvidenceNote: z.string().trim().min(5).max(3000),
});

export const complaintIdSchema = z.object({
  id: objectIdSchema,
});

export const complaintListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(COMPLAINT_STATUSES).optional(),
  keyword: z.string().trim().max(100).optional(),
  orderId: objectIdSchema.optional(),
});
