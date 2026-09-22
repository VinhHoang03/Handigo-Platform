import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { searchCustomerKnowledge } from "../../knowledge/customer-knowledge";

const inputSchema = z.object({}).strict();

export const getSystemInfoTool: AgentTool<z.infer<typeof inputSchema>> = {
  name: "get_system_info",
  description: "Giới thiệu Handigo, khả năng trợ lý và các trang chức năng dành cho customer. Không cung cấp số liệu kinh doanh hay danh sách dịch vụ động.",
  inputSchema,
  roles: ["CUSTOMER"],
  mutates: false,
  requiresConfirmation: false,
  execute: async () => ({ ...searchCustomerKnowledge("Handigo", "overview"), pages: [
    { label: "Dịch vụ", path: "/customer/services" }, { label: "Đơn của tôi", path: "/customer/bookings" },
    { label: "Hỗ trợ của tôi", path: "/customer/support" }, { label: "Ví", path: "/customer/wallet" },
    { label: "Hồ sơ", path: "/customer/profile" }, { label: "Hướng dẫn hỗ trợ", path: "/ho-tro" },
  ] }),
};
