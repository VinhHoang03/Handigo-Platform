import type { AgentConfirmation } from "../types/agent.types";
import { ClipboardCheck, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const labels: Record<string, string> = {
  service: "Dịch vụ", options: "Tùy chọn", address: "Địa chỉ", schedule: "Thời gian",
  unitPrice: "Đơn giá", quantity: "Số lượng",
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
  if (key === "quantity" && typeof value === "number") return value.toLocaleString("vi-VN");
  if (typeof value === "number") return `${value.toLocaleString("vi-VN")} đ`;
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join("\n");
  if (key === "paymentMethod") return paymentLabels[String(value)] ?? String(value);
  if (key === "schedule" && typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  }
  return typeof value === "string" ? value : "";
}

export function AgentConfirmationCard({ action, disabled, onDecision, readOnly = false }: {
  action: AgentConfirmation; disabled: boolean;
  readOnly?: boolean;
  onDecision?: (decision: "CONFIRM" | "REJECT") => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const expired = Date.parse(action.expiresAt) <= now;
  useEffect(() => {
    if (readOnly || expired) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [readOnly, expired]);
  const statusLabels = {
    WAITING_CONFIRMATION: "Bản xem trước đã lưu", EXECUTING: "Đang tạo đơn",
    SUCCEEDED: "Đã tạo đơn", REJECTED: "Đã từ chối", EXPIRED: "Bản xác nhận đã hết hiệu lực",
    UNKNOWN: "Kết quả tạo đơn cần được kiểm tra",
  };
  return <section aria-label="Xác nhận thao tác" className="overflow-hidden rounded-2xl border border-primary/20 bg-surface-container-lowest text-sm text-on-surface shadow-sm">
    <div className="flex items-start gap-3 border-b border-outline-variant/30 bg-primary/5 p-4">
      <ClipboardCheck aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
      <div>
        <h3 className="font-semibold">{String(action.preview.title ?? "Xác nhận thao tác")}</h3>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">{!readOnly && expired
          ? "Bản xác nhận đã hết hạn. Kiểm tra lại thông tin trước khi tiếp tục."
          : readOnly
          ? statusLabels[action.status ?? "WAITING_CONFIRMATION"]
          : action.tool === "create_booking"
            ? "Kiểm tra thông tin trước khi xác nhận. Bạn có thể nhắn thông tin cần sửa."
            : "Kiểm tra thông tin trước khi xác nhận."}</p>
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
    {action.booking && <div className="border-t border-outline-variant/30 p-4">
      <p className="mb-2 text-xs text-on-surface-variant">Mã đơn: {action.booking.orderCode ?? action.booking.orderId}</p>
      <Link className="font-medium text-primary underline" to={`/customer/bookings/${action.booking.orderId}`}>Xem đơn và trạng thái hiện tại</Link>
    </div>}
    {!readOnly && onDecision && <div className="border-t border-outline-variant/30 p-4">
      <p className="flex items-center gap-1.5 text-xs leading-5 text-on-surface-variant"><Clock3 size={14} aria-hidden="true" />Có hiệu lực đến {new Date(action.expiresAt).toLocaleTimeString("vi-VN")}.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={disabled} onClick={() => onDecision("REJECT")} className="min-h-11 rounded-xl border border-outline-variant px-3 py-2 font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">Từ chối</button>
        <button type="button" disabled={disabled} onClick={() => onDecision("CONFIRM")} className="min-h-11 rounded-xl bg-primary px-3 py-2 font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{expired ? "Kiểm tra lại thông tin" : "Xác nhận"}</button>
      </div>
    </div>}
  </section>;
}
