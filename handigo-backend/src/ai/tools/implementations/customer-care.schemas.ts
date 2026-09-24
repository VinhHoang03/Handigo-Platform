import { z } from "zod";
import { agentResponseSchema } from "../../../services/agentCustomerCare.service";
import { supportTicketListQuerySchema } from "../../../validations/supportTicket.validator";
import { complaintListQuerySchema } from "../../../validations/complaint.validator";
import { idSchema } from "./booking.schemas";

export const ticketIdSchema = z.object({ ticketId: idSchema }).strict();
export const complaintIdSchema = z.object({ complaintId: idSchema }).strict();
export const responseSchema = agentResponseSchema.extend({ ticketId: idSchema }).strict();
export const ticketDetailSchema = ticketIdSchema.extend({ responsePage: z.number().int().min(1).max(10000).optional() });
export const ticketQuerySchema = supportTicketListQuerySchema.pick({ page: true, status: true, category: true, priority: true }).strict();
export const complaintQuerySchema = complaintListQuerySchema.pick({ page: true, status: true, orderId: true }).strict();
