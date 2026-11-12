// Tập chỉnh tham số và tập kiểm tra tách riêng; không dùng dữ liệu hội thoại khách thật.
export const knowledgeEvaluationCases = [
  { id: "tune-repair-ac", set: "tuning", query: "Điều hòa chạy nhưng không mát, có thể do đâu và nên làm gì trước khi thợ đến?", title: "Điều hòa không lạnh hoặc lạnh yếu" },
  { id: "tune-repair-washer", set: "tuning", query: "Máy giặt không xả nước, trong lồng còn nước, cần kiểm tra gì an toàn?", title: "Máy giặt không xả nước hoặc không vắt" },
  { id: "heldout-repair-tv", set: "heldout", query: "Ti vi có tiếng nhưng mất hình, menu cũng không hiện", title: "Tivi có tiếng nhưng màn hình đen" },
  { id: "tune-address", set: "tuning", query: "Địa chỉ này chỉ dùng một lần, tôi không muốn lưu vào sổ", title: "Địa chỉ thực hiện, người nhận và sổ địa chỉ" },
  { id: "tune-qr", set: "tuning", query: "Tôi muốn hủy mã QR nhưng vẫn giữ đơn dịch vụ", title: "Hủy QR thanh toán nhưng giữ đơn" },
  { id: "tune-voucher", set: "tuning", query: "Có thể dùng hai mã giảm giá cho một đơn không?", title: "Chọn voucher và thay đổi mã giảm giá" },
  { id: "tune-complaint", set: "tuning", query: "Tôi có thể khiếu nại chất lượng dịch vụ trong bao lâu?", title: "Khiếu nại chất lượng dịch vụ" },
  { id: "tune-no-answer", set: "tuning", query: "Handigo bảo hành máy nén điều hòa chính hãng trong bao nhiêu năm?", title: null },
  { id: "heldout-rebook", set: "heldout", query: "dat lai dich vu da dung thang truoc thi gia cu co duoc giu khong", title: "Đặt lại đơn cũ, tìm đơn và chọn thợ từng phục vụ" },
  { id: "heldout-provider", set: "heldout", query: "Thợ tôi chọn đang ngoại tuyến, hệ thống có tự đổi sang người khác không?", title: "Chọn chuyên gia theo tên hoặc tiêu chí" },
  { id: "heldout-support", set: "heldout", query: "Tôi gặp lỗi tài khoản, có cần chọn một đơn hàng mới gửi được hỗ trợ không?", title: "Gửi và theo dõi yêu cầu hỗ trợ" },
  { id: "heldout-no-answer", set: "heldout", query: "Ngày mai giá cổ phiếu nào tăng mạnh nhất?", title: null },
] as const;
