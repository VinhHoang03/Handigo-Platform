import { z } from "zod";
import { bookingAttachmentsSchema } from "./agent/booking-attachments";
import { bookingActionSchema } from "./agent/booking-actions";

export const agentRequestSchema = z.union([
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), paymentStatus: z.object({
    orderId: z.string().regex(/^[a-f\d]{24}$/i, "ID đơn hàng không hợp lệ."),
  }).strict() }).strict(),
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), message: z.string().trim().min(1).max(4000),
    customerAttachments: bookingAttachmentsSchema.optional(), bookingAction: bookingActionSchema.optional() }).strict(),
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), confirmation: z.object({
    actionId: z.string().uuid(), decision: z.enum(["CONFIRM", "REJECT"]),
    policyConsent: z.object({ accepted: z.literal(true), version: z.string().regex(/^[a-f\d]{64}$/, "Phiên bản chính sách không hợp lệ.") }).strict().optional(),
  }).strict() }).strict(),
]);
