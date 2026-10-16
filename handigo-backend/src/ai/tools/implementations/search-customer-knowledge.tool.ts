import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { knowledgeTopics, searchCustomerKnowledge } from "../../knowledge/customer-knowledge";

const inputSchema = z.object({ query: z.string().trim().min(1).max(200), topic: z.enum(knowledgeTopics).optional() }).strict();

export const searchCustomerKnowledgeTool: AgentTool<z.infer<typeof inputSchema>> = {
  name: "search_customer_knowledge",
  description: "Tra cứu chính sách/hướng dẫn đã đối chiếu: voucher và chọn thợ (topic booking), địa chỉ/người nhận (account), đặt dịch vụ, thanh toán, hủy/hoàn tiền, khiếu nại, hỗ trợ. Dùng trước khi trả lời chính sách. query là từ khóa; topic giúp chọn nhóm khi từ khóa không khớp. Không có nguồn thì không suy đoán; giá, voucher và thợ hiện tại phải tra tool nghiệp vụ.",
  inputSchema,
  roles: ["CUSTOMER"],
  mutates: false,
  requiresConfirmation: false,
  execute: async (_context, args) => searchCustomerKnowledge(args.query, args.topic),
};
