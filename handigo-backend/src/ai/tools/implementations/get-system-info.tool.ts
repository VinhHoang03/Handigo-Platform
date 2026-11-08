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
  execute: async () => ({ ...searchCustomerKnowledge("Handigo", "overview"),
    customerActions: "Dời lịch và phản hồi đề nghị dời lịch; tra điểm, đổi voucher; tra ví, tạo/kiểm tra/hủy nạp ví; ước tính thời gian thợ đến khi có GPS mới.",
    repairAdvice: {
      description: "Nhận mô tả sự cố, hỏi làm rõ, nêu nguyên nhân có thể, hướng dẫn an toàn trước khi thợ đến và đối chiếu dịch vụ thực tế.",
      limitations: "Tư vấn tham khảo cho tình huống đã có kiến thức; không chẩn đoán chắc chắn, chỉ quan sát ảnh khách yêu cầu, không hướng dẫn tự tháo sửa.",
    }, pages: [
    { label: "Dịch vụ", path: "/customer/services" }, { label: "Đơn của tôi", path: "/customer/bookings" },
    { label: "Hỗ trợ của tôi", path: "/customer/support" }, { label: "Ví", path: "/customer/wallet" },
    { label: "Điểm thưởng", path: "/customer/rewards" }, { label: "Hồ sơ", path: "/customer/profile" }, { label: "Hướng dẫn hỗ trợ", path: "/ho-tro" },
  ] }),
};
