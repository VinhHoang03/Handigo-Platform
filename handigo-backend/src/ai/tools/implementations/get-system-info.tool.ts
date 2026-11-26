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
    customerActions: "Dời lịch và phản hồi đề nghị dời lịch; tra điểm, đổi voucher; tra ví, tạo/kiểm tra/hủy nạp ví; chọn ngân hàng đã che và tạo/theo dõi yêu cầu rút tiền; thanh toán phần báo giá còn lại bằng ví hoặc PayOS sau khi đơn hoàn thành; báo cáo hành vi vi phạm, theo dõi/hủy/bổ sung ảnh; tra kết quả kiểm duyệt nhận xét; xóa đơn chưa thanh toán chưa tìm thợ sau xác nhận riêng; xóa địa chỉ và đổi mặc định sau xác nhận; ước tính thời gian thợ đến khi có GPS mới.",
    repairAdvice: {
      description: "Nhận mô tả sự cố và đọc dấu hiệu/mã lỗi trong ảnh khi khách yêu cầu; hỏi làm rõ, tư vấn từ bài Mẹo sửa chữa hiện hành, đề xuất dịch vụ thực tế rồi hỏi khách có muốn tìm thợ phù hợp. Thiếu bài viết vẫn có thể tìm dịch vụ để thợ kiểm tra, nhưng chưa hướng dẫn kỹ thuật chi tiết. Chỉ tra thợ khi khách đồng ý, theo đúng dịch vụ, địa chỉ và thời gian; tạo đơn và thanh toán cần xác nhận.",
      limitations: "Tư vấn tham khảo cho tình huống đã có kiến thức; không chẩn đoán chắc chắn, chỉ quan sát ảnh khách yêu cầu, không hướng dẫn tự tháo sửa.",
    }, pages: [
    { label: "Dịch vụ", path: "/customer/services" }, { label: "Đơn của tôi", path: "/customer/bookings" },
    { label: "Hỗ trợ của tôi", path: "/customer/support" }, { label: "Ví", path: "/customer/wallet" },
    { label: "Tài khoản ngân hàng", path: "/customer/bank-accounts" },
    { label: "Điểm thưởng", path: "/customer/rewards" }, { label: "Hồ sơ", path: "/customer/profile" }, { label: "Hướng dẫn hỗ trợ", path: "/ho-tro" },
  ] }),
};
