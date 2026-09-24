import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { knowledgeTopics, searchCustomerKnowledge } from "../../knowledge/customer-knowledge";

const inputSchema = z.object({ query: z.string().trim().min(1).max(200), topic: z.enum(knowledgeTopics).optional() }).strict();

export const searchCustomerKnowledgeTool: AgentTool<z.infer<typeof inputSchema>> = {
  name: "search_customer_knowledge",
  description: "Tra cứu chính sách và hướng dẫn Handigo đã đối chiếu: đặt dịch vụ, thanh toán, hủy/hoàn tiền, khiếu nại, hỗ trợ, tài khoản. Dùng trước khi trả lời chính sách. query là từ khóa; topic giúp chọn đúng nhóm khi từ khóa không khớp. Không có nguồn thì không suy đoán.",
  inputSchema,
  roles: ["CUSTOMER"],
  mutates: false,
  requiresConfirmation: false,
  execute: async (_context, args) => searchCustomerKnowledge(args.query, args.topic),
};
