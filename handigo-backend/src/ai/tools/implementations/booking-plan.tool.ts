import { bookingPlanSchema, manageBookingPlan, type BookingPlanInput } from "../../agent/booking-plan";
import type { AgentTool } from "../tool.interface";

export const bookingPlanTool: AgentTool<BookingPlanInput> = {
  name: "manage_booking_plan", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  description: "Điều phối nhiều yêu cầu đặt dịch vụ của khách, chỉ lưu tiến độ phiên chat, không tạo đơn/thu tiền. Nếu khách đang có bản nháp một đơn và muốn thêm việc, dùng includeCurrentDraft true; mục đầu mô tả bản nháp hiện tại, không gửi seed để giữ nguyên dữ liệu. create khi khách yêu cầu từ hai đơn khác nhau, tối đa 10; mỗi item có label, request đầy đủ và seed chỉ chứa dữ kiện khách cung cấp. Không tách số lượng cùng dịch vụ/cùng địa chỉ/lịch thành nhiều đơn. Chỉ dùng ID thật từ view. next sau khi đã tạo/bỏ yêu cầu; skip bỏ yêu cầu chưa tạo khi khách yêu cầu rõ; defer để lại để xử lý việc khác; pause/resume/cancel theo yêu cầu khách; cancel không hủy đơn đã tạo. edit chỉ sửa yêu cầu chưa bắt đầu/để lại; append bổ sung yêu cầu. Mỗi đơn vẫn phải có xác nhận riêng bằng create_booking. Thiếu dịch vụ/thợ thì giải thích và hỏi sửa/để lại/bỏ, không tự bỏ. Không sao chép ảnh, người nhận, voucher hoặc lịch từ đơn khác; chỉ gán ảnh vào seed khi khách nói rõ ảnh cho yêu cầu nào. Cấm chuyển tiếp khi có kết quả chưa rõ hoặc xác nhận đang chờ. Sau create/next/resume, dùng request và seed của item đang active để tiếp tục update_booking_draft, không gọi create_booking trực tiếp.",
  inputSchema: bookingPlanSchema,
  execute: async (context, args) => manageBookingPlan(context, args),
};
