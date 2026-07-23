export const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) || url.includes("/image/upload/");

export const downloadUrl = (url: string) =>
  url.includes("/upload/") ? url.replace("/upload/", "/upload/fl_attachment/") : url;

export const formatDate = (value?: string) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
};

export const documentTypeLabel = (type?: string) => (type === "passport" ? "Hộ chiếu" : "CCCD");

export const rejectionReasons = [
  "Giấy tờ định danh không hợp lệ",
  "Không thể xác minh chứng chỉ",
  "Kinh nghiệm chưa đáp ứng",
  "Thiếu thông tin bắt buộc",
  "Khác",
];
