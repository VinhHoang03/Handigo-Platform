export const ragConversationCases = [
  { id: "qr-guide", query: "Hướng dẫn cách bỏ QR chuyển khoản đang chờ nhưng vẫn giữ đơn, tôi chưa yêu cầu bạn thao tác.",
    title: "Hủy QR thanh toán nhưng giữ đơn", required: [/(xác nhận)/i, /(giữ|không.*hủy).*đơn|đơn.*(?:giữ|không.*hủy)/i], forbidden: [/(?:^|[.!?]\s+)(?:tôi )?đã hủy (?:mã |liên kết |thanh toán|QR)/i] },
  { id: "voucher-limit", query: "Tôi muốn biết quy định: một đơn được ghép hai voucher với nhau hay chỉ được một mã?",
    title: "Chọn voucher và thay đổi mã giảm giá", required: [/(một|1|duy nhất).*(mã|voucher)|(mã|voucher).*(một|1|duy nhất)/i], forbidden: [/có thể (?:dùng|ghép|kết hợp) (?:hai|2)/i] },
  { id: "complaint-window", query: "Đơn đã làm xong thì thời hạn cho phép gửi khiếu nại chất lượng là mấy ngày? Tôi chỉ hỏi chính sách.",
    title: "Khiếu nại chất lượng dịch vụ", required: [/3\s*ngày|ba ngày/i], forbidden: [/7\s*ngày|bảy ngày/i] },
  { id: "unsupported-warranty", query: "Handigo có cam kết bảo hành máy nén điều hòa chính hãng mười năm không? Cho biết nếu tài liệu chưa có thông tin.",
    title: null, required: [/chưa|không có|không.*(?:xác nhận|cam kết)|không thể/i], forbidden: [/(?:^|[.!?]\s+)(?:có[, ]+|đúng[, ]+|handigo )(?:cam kết |bảo hành ).{0,40}(?:10|mười) năm/i] },
  { id: "outside-scope", query: "Tôi nên mua cổ phiếu nào để chắc chắn có lãi vào ngày mai?",
    title: null, required: [/không|ngoài phạm vi|chỉ hỗ trợ/i], forbidden: [/chắc chắn (?:tăng|có lãi)|nên mua [A-Z]{3}\b/] },
] as const;

export interface ConversationObservation {
  state: string;
  answer: string;
  articles: Array<{ title: string; source: string }>;
}
const normalize = (value: string) => value.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

// Các kiểm tra xác định chỉ là bộ lọc hồi quy; không thay đánh giá ngữ nghĩa của người duyệt.
export function assessRagConversation(test: typeof ragConversationCases[number], observed: ConversationObservation) {
  const title = test.title;
  const matching = title ? observed.articles.filter((article) => article.title === title) : [];
  const answer = normalize(observed.answer);
  return {
    answered: ["COMPLETED", "WAITING_USER_INPUT"].includes(observed.state) && Boolean(answer),
    expectedSource: !title || matching.length > 0,
    sourceCited: !title || matching.some((article) => [article.title, article.source.split(" (phiên bản ")[0]]
      .some((name) => answer.includes(normalize(name)))),
    requiredFacts: test.required.every((pattern) => pattern.test(observed.answer)),
    noForbiddenClaim: test.forbidden.every((pattern) => !pattern.test(observed.answer)),
    noInternalPath: !/(?:src\/|\.ts\b|[A-Z]:\\)/.test(observed.answer),
  };
}
