import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { agentRequestAttachments, bookingAttachmentsSchema } from "../../agent/booking-attachments";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { receipt } from "./customer-care.reply";

const schema = z.object({ complaintId: idSchema, customerAttachments: bookingAttachmentsSchema.optional(), note: z.string().trim().max(1000).optional() }).strict();
export const addComplaintEvidenceTool: AgentTool<z.infer<typeof schema>> = {
  name: "add_complaint_evidence", description: "Bổ sung ảnh bằng chứng đã tải trong chat cho khiếu nại chưa kết thúc của khách. Phải xác định đúng khiếu nại và xác nhận ảnh trước khi gửi.",
  inputSchema: schema, mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: (context, args) => care.previewEvidence(context.user.id, args.complaintId, agentRequestAttachments(context.session, args.customerAttachments), args.note),
  execute: (context, args) => care.addEvidence(context.user.id, args.complaintId, agentRequestAttachments(context.session, args.customerAttachments), args.note),
  reply: receipt("Đã bổ sung ảnh bằng chứng cho khiếu nại."),
};
