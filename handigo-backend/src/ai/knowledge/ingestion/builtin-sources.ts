import { customerKnowledge } from "../customer-knowledge";
import { repairKnowledgeSources } from "../repair-cases";

// Mã nguồn ổn định, không phụ thuộc vị trí bài trong mảng; đổi tiêu đề phải đối chiếu mã này.
const keys: Record<string, string> = {
  "Tra kết quả kiểm duyệt nhận xét": "feedback-moderation",
  "Xóa đơn chưa thanh toán đã tạo": "discard-unpaid-order",
  "Đặt lại đơn cũ, tìm đơn và chọn thợ từng phục vụ": "booking-history",
  "Giải thích báo giá và tra chi tiết hoàn tiền": "quotation-refunds",
  "Gửi ảnh hiện trạng khi đặt dịch vụ trong chat": "booking-images",
  "Handigo và các chức năng dành cho khách hàng": "overview",
  "Đặt dịch vụ và quản lý đơn": "booking",
  "Phương thức thanh toán và tiền cọc": "payment",
  "Đổi phương thức khi PayOS đang chờ": "payment-switch",
  "Hủy QR thanh toán nhưng giữ đơn": "payment-cancellation",
  "Điều kiện hủy đơn và hoàn tiền": "cancellation",
  "Khiếu nại chất lượng dịch vụ": "complaint",
  "Báo cáo chất lượng dịch vụ (khiếu nại)": "complaint",
  "Báo cáo hành vi vi phạm và theo dõi xử lý": "report",
  "Rút tiền từ ví và theo dõi yêu cầu rút": "withdrawal",
  "Dời lịch đơn đã tạo và phản hồi đề nghị": "reschedule",
  "Tra thời gian thợ đến và theo dõi vị trí": "arrival-estimate",
  "Gửi và theo dõi yêu cầu hỗ trợ": "support",
  "Tài khoản, hồ sơ và địa chỉ": "account",
  "Chọn voucher và thay đổi mã giảm giá": "voucher",
  "Chọn chuyên gia theo tên hoặc tiêu chí": "provider",
  "Địa chỉ thực hiện, người nhận và sổ địa chỉ": "address",
};
export function builtinKnowledgeSources() {
  return [...customerKnowledge.map(({ keywords: _keywords, ...source }) => {
    const key = keys[source.title];
    if (!key) throw new Error("Nguồn nội bộ mới cần được đối chiếu mã định danh trước khi nhập.");
    return { ...source, sourceKey: `handigo/customer/${key}` };
  }), ...repairKnowledgeSources()];
}
