import type { AgentConfirmation } from "../types/agent.types";
import { ClipboardCheck, Clock3 } from "lucide-react";

const labels: Record<string, string> = {
  service: "Dịch vụ", options: "Tùy chọn", address: "Địa chỉ", schedule: "Thời gian",
  paymentMethod: "Thanh toán", amount: "Số tiền", description: "Mô tả",
  orderCode: "Mã đơn", reason: "Lý do hủy", paidAmount: "Đã thanh toán",
  refundAmount: "Dự kiến hoàn", cancellationFee: "Phí hủy", note: "Lưu ý",
  paymentLabel: "Khoản thanh toán",
  subject: "Tiêu đề yêu cầu", category: "Nhóm hỗ trợ", priority: "Độ ưu tiên",
  caseId: "Mã yêu cầu", caseStatus: "Trạng thái hiện tại",
};
const paymentLabels: Record<string, string> = { cash: "Tiền mặt", bank: "Chuyển khoản", wallet: "Ví Handigo" };
function formatValue(key: string, value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return `${value.toLocaleString("vi-VN")} đ`;
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join("\n");
  if (key === "paymentMethod") return paymentLabels[String(value)] ?? String(value);
  if (key === "schedule" && typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  }
  return typeof value === "string" ? value : "";
}

export function AgentConfirmationCard({ action, disabled, onDecision }: {
  action: AgentConfirmation; disabled: boolean;
  onDecision: (decision: "CONFIRM" | "REJECT") => void;
}) {
  return <section aria-label="Xác nhận thao tác" className="overflow-hidden rounded-2xl border border-primary/20 bg-surface-container-lowest text-sm text-on-surface shadow-sm">
    <div className="flex items-start gap-3 border-b border-outline-variant/30 bg-primary/5 p-4">
      <ClipboardCheck aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
      <div>
        <h3 className="font-semibold">{String(action.preview.title ?? "Xác nhận thao tác")}</h3>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">Kiểm tra thông tin trước khi xác nhận.</p>
      </div>
    </div>
    <dl className="space-y-3 p-4">
      {Object.entries(labels).map(([key, label]) => {
        const value = formatValue(key, action.preview[key]);
        return value ? <div key={key} className={key === "amount" ? "rounded-xl bg-primary/5 p-3" : ""}>
          <dt className="text-xs text-on-surface-variant">{key === "amount" && action.preview.serviceType === "variable_price" ? "Tiền đặt cọc" : label}</dt>
          <dd className={`mt-1 whitespace-pre-wrap break-words leading-5 ${key === "amount" ? "text-lg font-semibold text-primary" : "font-medium"}`}>{value}</dd>
        </div> : null;
      })}
    </dl>
    <div className="border-t border-outline-variant/30 p-4">
      <p className="flex items-center gap-1.5 text-xs leading-5 text-on-surface-variant"><Clock3 size={14} aria-hidden="true" />Có hiệu lực đến {new Date(action.expiresAt).toLocaleTimeString("vi-VN")}.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={disabled} onClick={() => onDecision("REJECT")} className="min-h-11 rounded-xl border border-outline-variant px-3 py-2 font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">Từ chối</button>
        <button type="button" disabled={disabled} onClick={() => onDecision("CONFIRM")} className="min-h-11 rounded-xl bg-primary px-3 py-2 font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">Xác nhận</button>
      </div>
    </div>
  </section>;
}
