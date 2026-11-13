import { criterionLabels, sourceLabels, statusLabels, type Assessment } from "./adminAI.types";

export function sourceLabel(sourceId: string) {
  const [kind, number] = sourceId.split(":");
  if (kind === "image") return `Ảnh đính kèm ${/^\d+$/.test(number || "") ? number : ""}`.trim();
  const labels: Record<string, string> = { ...sourceLabels, policy: "Chính sách hệ thống", order: "Đơn hàng", payment: "Thanh toán", refund: "Hoàn tiền", message: "Hội thoại", order_status: "Lịch sử đơn hàng", service: "Dịch vụ", category: "Danh mục", feedback: "Đánh giá", quotation: "Báo giá", quotation_item: "Hạng mục báo giá", wallet_transaction: "Giao dịch ví", financial_inventory: "Dữ liệu giao dịch tài chính", payment_inventory: "Dữ liệu thanh toán", evidence_inventory: "Danh sách bằng chứng", order_evidence_inventory: "Bằng chứng của đơn hàng" };
  return labels[kind] || "Dữ liệu đối chiếu";
}

export function criterionLabel(item: Assessment, code: string) {
  const configured = item.policy?.criteria.find(rule => rule.code === code)?.description;
  if (configured) return configured;
  if (code === "description_present") return "Đã có mô tả đăng ký";
  if (code === "relevance") return item.feature === "provider_application" ? "Mô tả phù hợp với dịch vụ đăng ký" : "Nội dung gợi ý dịch vụ phù hợp";
  return criterionLabels[code as keyof typeof criterionLabels] || (code === "description" ? "Mô tả dịch vụ" : "Tiêu chí kiểm duyệt");
}

const textLabels: Record<string, string> = {
  get_payment_status: "chức năng kiểm tra trạng thái thanh toán",
  financial_inventory: "dữ liệu giao dịch tài chính", payment_inventory: "dữ liệu thanh toán",
  evidence_inventory: "danh sách bằng chứng", order_evidence_inventory: "bằng chứng của đơn hàng",
  unpaid: "chưa thanh toán", paid: "đã thanh toán", refunded: "đã hoàn tiền", cancelled: "đã hủy",
  completed: "đã hoàn thành", pending: "đang chờ xử lý", under_review: "đang xem xét",
  evidence_requested: "đang chờ bổ sung bằng chứng", manual_review: "cần kiểm tra thủ công",
  cash: "tiền mặt", succeeded: "thành công", failed: "thất bại", handigo_wallet: "ví Handigo", source_account: "tài khoản thanh toán ban đầu",
};

export function readableText(text: string) {
  return text.replace(/\b[a-f\d]{24}\b/gi, "")
    .replace(/\b(?:provider_application|service_suggestion|report|complaint|order|payment|refund|wallet_transaction|order_status|feedback|quotation|quotation_item|service|category|message):\s*/g, "")
    .replace(/`([a-z][a-z_]+)`/g, (original, token: string) => textLabels[token] || original)
    .replace(/\b[a-z][a-z_]+\b/g, token => textLabels[token] || token)
    .replace(/\([\s,;:/|`"']*\)|\[[\s,;:/|`"']*\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .trim();
}

const fieldLabels: Record<string, string> = {
  description: "Mô tả", experienceYears: "Số năm kinh nghiệm", identityDeclared: "Giấy tờ đã khai", type: "Loại giấy tờ", issuedAt: "Ngày cấp", expiresAt: "Ngày hết hạn", applicationType: "Loại hồ sơ", status: "Trạng thái", createdAt: "Ngày tạo", updatedAt: "Ngày cập nhật", certificates: "Chứng chỉ", services: "Dịch vụ đăng ký", name: "Tên", title: "Tên", issuer: "Đơn vị cấp", hasImages: "Có ảnh đính kèm", suggestedServiceName: "Dịch vụ đề xuất", suggestedCategoryName: "Danh mục đề xuất", reportType: "Loại phản ánh", targetType: "Đối tượng phản ánh", content: "Nội dung", amount: "Số tiền", paymentStatus: "Trạng thái thanh toán", paymentMethod: "Phương thức thanh toán", orderCode: "Mã đơn hàng", note: "Ghi chú", reason: "Lý do", text: "Nội dung", fullName: "Họ và tên",
};

function describe(value: unknown, field = ""): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(entry => describe(entry, field));
  if (typeof value === "object") return Object.entries(value).flatMap(([key, entry]) => {
    if (/(?:^_?id$|Ids?$|Hash$|Url$)/.test(key)) return [];
    const lines = describe(entry, key);
    return lines.length ? [`${fieldLabels[key] || "Thông tin"}: ${lines.join("; ")}`] : [];
  });
  if (typeof value === "boolean") return [value ? "Có" : "Không"];
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text) && Number.isFinite(Date.parse(text))) return [new Date(text).toLocaleString("vi-VN")];
  const labels: Record<string, string> = { ...statusLabels, cccd: "Căn cước công dân", passport: "Hộ chiếu", initial: "Đăng ký lần đầu", service_addition: "Bổ sung dịch vụ", cash: "Tiền mặt", paid: "Đã thanh toán", unpaid: "Chưa thanh toán" };
  const result = labels[text] || readableText(text);
  return result ? [field === "experienceYears" ? `${result} năm` : result] : [];
}

export function evidenceLines(quote: string): string[] {
  try { return describe(JSON.parse(quote)); }
  catch {
    if (/^\s*(?:\[|\{|"[^"]+"\s*:)/.test(quote)) return ["Nội dung trích dẫn chưa đầy đủ. Vui lòng xem hồ sơ gốc."];
    return [readableText(quote)];
  }
}
