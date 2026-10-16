import type { ToastType } from "./toast-context";

const fallbackMessages: Record<ToastType, string> = {
  error: "Có lỗi xảy ra. Vui lòng thử lại.",
  success: "Thao tác đã hoàn tất thành công.",
  info: "Hệ thống có thông báo mới. Vui lòng kiểm tra lại.",
};

/** Chuẩn hóa Unicode và giữ lỗi kỹ thuật/lỗi mã hóa khỏi nội dung toast. */
export function getToastMessage(message: string, type: ToastType): string {
  const normalized = message.trim().normalize("NFC");
  const hasEncodingError = /\uFFFD|[\u0080-\u009F]|[ÃÂ][\u0080-\u00BF]|á[º»]|Æ[°±]|Ä[\u0080-\u00BF‘’]|â[€\u0080-\u00BF]/u.test(normalized);
  if (!normalized || hasEncodingError) return fallbackMessages[type];

  if (/^(?:Network Error|Failed to fetch|Load failed)$/i.test(normalized)) {
    return "Không thể kết nối đến hệ thống. Vui lòng kiểm tra kết nối mạng và thử lại.";
  }
  if (/^(?:timeout of \d+ms exceeded|Request timed out|The operation was aborted\.?)/i.test(normalized)) {
    return "Yêu cầu xử lý quá lâu hoặc đã bị gián đoạn. Vui lòng thử lại.";
  }

  // Thông báo từ API/thư viện có thể là tiếng Anh hoặc tiếng Việt không dấu.
  const hasVietnameseText = /[àáâãèéêìíòóôõùúýăđĩũơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯ\u1EA0-\u1EF9]/u.test(normalized);
  return hasVietnameseText ? normalized : fallbackMessages[type];
}
