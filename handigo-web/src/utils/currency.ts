/**
 * Định dạng tiền tệ VNĐ dùng chung.
 *
 * Trước đây mỗi trang tự gọi `.toLocaleString()` hoặc `.toLocaleString('vi-VN')`
 * rồi nối thêm "đ" thủ công, dễ lệch định dạng giữa các nơi. Quy về một hàm.
 */
export const formatCurrency = (amount: number): string =>
  `${new Intl.NumberFormat('vi-VN').format(Number.isFinite(amount) ? amount : 0)}đ`;
