import { IViolation, PenaltyType, ViolationSeverity } from "../models/violation.model";

const penaltyLabels: Record<PenaltyType, string> = {
  WARNING: "Cảnh cáo", warning: "Cảnh cáo",
  TEMPORARY_SUSPEND: "Tạm khóa tài khoản", PERMANENT_BAN: "Khóa tài khoản vĩnh viễn",
  account_locked: "Khóa tài khoản", provider_suspended: "Đình chỉ tài khoản nhà cung cấp",
  RESTRICT_FEATURE: "Hạn chế tính năng", RESTRICT_ORDER_RECEIVING: "Hạn chế nhận đơn",
  RESTRICT_CHAT: "Hạn chế trò chuyện", RESTRICT_VOUCHER: "Hạn chế mã giảm giá",
};
const severityLabels: Record<ViolationSeverity, string> = {
  LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", CRITICAL: "Nghiêm trọng",
  low: "Thấp", medium: "Trung bình", high: "Cao",
};
const featureLabels: Record<string, string> = {
  chat: "Trò chuyện", voucher: "Mã giảm giá", order_receiving: "Nhận đơn", booking: "Đặt dịch vụ",
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);
const formatDate = (value: Date) => new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
}).format(value) + " (giờ Việt Nam)";

type EmailViolation = Pick<IViolation, "violationType" | "severity" | "penaltyType" | "reason" | "adminDecision" | "penalty" | "startAt" | "endAt">;

export const buildViolationEmail = (violation: EmailViolation, fullName: string, violationId: string) => {
  const type = violation.penaltyType;
  const penalty = penaltyLabels[type];
  const rows: [string, string][] = [
    ["Mã quyết định", violationId], ["Nội dung vi phạm", violation.violationType],
    ["Lý do xử lý", violation.reason || "Không có thông tin bổ sung"],
    ["Mức độ vi phạm", severityLabels[violation.severity]], ["Hình thức xử lý", penalty],
    ["Quyết định của quản trị viên", violation.adminDecision || penalty],
  ];
  if (violation.startAt) rows.push(["Thời điểm áp dụng", formatDate(violation.startAt)]);
  if (type === "TEMPORARY_SUSPEND") {
    const duration = violation.penalty?.duration ?? violation.penalty?.durationDays;
    rows.push(["Thời hạn", `${duration} ${violation.penalty?.durationUnit === "hours" ? "giờ" : "ngày"}`]);
    if (violation.endAt) rows.push(["Thời điểm hết hạn", formatDate(violation.endAt)]);
  }
  if (type === "RESTRICT_FEATURE" && violation.penalty?.feature) {
    rows.push(["Tính năng bị hạn chế", featureLabels[violation.penalty.feature] || violation.penalty.feature]);
  }
  let impact = "Tài khoản bị hạn chế sử dụng tính năng nêu trên theo quyết định xử lý.";
  if (type === "WARNING" || type === "warning") {
    impact = "Quyết định cảnh cáo này không khóa tài khoản. Vui lòng tuân thủ quy định Handigo và không tái phạm.";
  } else if (type === "TEMPORARY_SUSPEND") {
    impact = "Bạn không thể đăng nhập hoặc sử dụng các chức năng cần xác thực trong thời gian bị khóa. "
      + (violation.endAt ? `Bạn sẽ được mở khóa tài khoản vào ${formatDate(violation.endAt)}, ` : "Tài khoản được tự động mở khi hết hạn, ")
      + "nếu không còn quyết định khóa khác đang hiệu lực hoặc khóa thủ công. Sau đó, vui lòng đăng nhập lại.";
  } else if (["PERMANENT_BAN", "account_locked", "provider_suspended"].includes(type)) {
    impact = type === "PERMANENT_BAN"
      ? "Tài khoản bị khóa vĩnh viễn và không tự động mở lại theo thời gian. Bạn không thể đăng nhập hoặc sử dụng các chức năng cần xác thực."
      : "Tài khoản bị khóa và không tự động mở lại theo thời gian. Bạn không thể đăng nhập hoặc sử dụng các chức năng cần xác thực.";
  }
  const greeting = `Xin chào ${fullName || "bạn"},`;
  const intro = "Handigo thông báo quyết định xử lý vi phạm đối với tài khoản của bạn.";
  const support = "Nếu cần giải đáp hoặc đề nghị xem xét lại, vui lòng phản hồi email này và cung cấp mã quyết định cùng thông tin liên quan.";
  return {
    subject: `[Handigo] ${penalty} do vi phạm`,
    text: [greeting, intro, ...rows.map(([label, value]) => `${label}: ${value}`), impact, support, "Đội ngũ Handigo"].join("\n\n"),
    html: `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6"><div style="max-width:640px;margin:auto;padding:24px"><h1 style="font-size:22px">Thông báo xử lý vi phạm</h1><p>${escapeHtml(greeting)}</p><p>${intro}</p><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><th style="text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #ddd">${label}</th><td style="padding:10px;border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("")}</table><p>${impact}</p><p>${support}</p><p>Đội ngũ Handigo</p></div></body></html>`,
  };
};
