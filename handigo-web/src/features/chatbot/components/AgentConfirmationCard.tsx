import type { AgentConfirmation } from "../types/agent.types";
import { ArrowUpRight, Check, ClipboardCheck, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

const labels: Record<string, string> = {
  service: "Dịch vụ", options: "Tùy chọn", address: "Địa chỉ", schedule: "Thời gian",
  unitPrice: "Đơn giá", voucherCode: "Voucher", quantity: "Số lượng",
  originalAmount: "Giá trước giảm", discountAmount: "Giảm giá", providerName: "Chuyên gia ưu tiên",
  previousAddress: "Địa chỉ trước khi sửa", recipientName: "Người nhận", recipientPhone: "Số điện thoại người nhận",
  addressNote: "Ghi chú địa chỉ",
  rating: "Số sao",
  paymentMethod: "Thanh toán", amount: "Số tiền", description: "Mô tả",
  orderCode: "Mã đơn", reason: "Lý do hủy", paidAmount: "Đã thanh toán",
  refundAmount: "Dự kiến hoàn", cancellationFee: "Phí hủy", note: "Lưu ý",
  paymentLabel: "Khoản thanh toán",
  subject: "Tiêu đề yêu cầu", category: "Nhóm hỗ trợ", priority: "Độ ưu tiên",
  caseId: "Mã yêu cầu", caseStatus: "Trạng thái hiện tại",
  responseDeadline: "Hạn phản hồi",
  quotationCode: "Mã báo giá", quotationAmount: "Tổng báo giá", providerCompensation: "Chuyển cho thợ",
};
const paymentLabels: Record<string, string> = { cash: "Tiền mặt", bank: "Trực tuyến", wallet: "Ví Handigo" };
function formatValue(key: string, value: unknown, serviceType?: unknown) {
  if (value == null) return "";
  if (["quantity", "rating"].includes(key) && typeof value === "number") return value.toLocaleString("vi-VN");
  if (typeof value === "number") return `${value.toLocaleString("vi-VN")} đ`;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => {
    if (key !== "options" || serviceType !== "variable_price") return item;
    return item.replace(/\s*:\s*0(?:[.,]0+)?\s*(?:đ|₫|VND)\s*$/i, "").replace(/\s*[×x]\s*1\s*$/i, "");
  }).join("\n");
  if (key === "paymentMethod") return paymentLabels[String(value)] ?? String(value);
  if (["schedule", "responseDeadline"].includes(key) && typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  }
  return typeof value === "string" ? value : "";
}

export function AgentConfirmationCard({ action, disabled, onDecision, readOnly = false, beforeDecision, confirmDisabled = false, voucherField }: {
  action: AgentConfirmation; disabled: boolean;
  readOnly?: boolean;
  onDecision?: (decision: "CONFIRM" | "REJECT") => void;
  beforeDecision?: ReactNode;
  confirmDisabled?: boolean;
  voucherField?: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  const hasVoucherDiscount = typeof action.preview.voucherCode === "string" && Boolean(action.preview.voucherCode.trim())
    && typeof action.preview.discountAmount === "number" && action.preview.discountAmount > 0;
  const expired = Date.parse(action.expiresAt) <= now;
  useEffect(() => {
    if (readOnly || expired) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [readOnly, expired]);
  const statusLabels = {
    WAITING_CONFIRMATION: "Bản xem trước đã lưu", EXECUTING: action.tool === "create_booking" ? "Đang tạo đơn" : "Đang thực hiện",
    SUCCEEDED: action.tool === "create_booking" ? "Đã tạo đơn" : "Đã thực hiện", REJECTED: "Đã từ chối", EXPIRED: "Bản xác nhận đã hết hiệu lực",
    UNKNOWN: "Kết quả thao tác cần được kiểm tra",
  };
  return <section aria-label="Xác nhận thao tác" className={`overflow-hidden rounded-2xl border bg-surface-container-lowest text-sm text-on-surface ${readOnly ? "border-outline-variant/45" : "border-primary/25 shadow-[0_4px_16px_-4px_rgba(19,27,46,0.08)]"}`}>
    <div className="flex items-start gap-3 border-b border-outline-variant/30 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><ClipboardCheck aria-hidden="true" size={20} /></span>
      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary">{readOnly ? "Thông tin đã lưu" : "Kiểm tra & xác nhận"}</p>
        <h3 className="font-headline-md text-base font-semibold leading-6">{String(action.preview.title ?? "Xác nhận thao tác")}</h3>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">{!readOnly && expired
          ? "Bản xác nhận đã hết hạn. Kiểm tra lại thông tin trước khi tiếp tục."
          : readOnly
          ? statusLabels[action.status ?? "WAITING_CONFIRMATION"]
          : action.tool === "create_booking"
            ? "Bạn có thể sửa thông tin bên dưới trước khi đặt."
            : "Kiểm tra thông tin trước khi xác nhận."}</p>
      </div>
    </div>
    <dl className="px-4 py-2">
      {[...Object.entries(labels).filter(([key]) => key !== "amount"
        && !(action.tool === "create_booking" && (key === "originalAmount" || key === "discountAmount" && !hasVoucherDiscount))), ["amount", labels.amount]].map(([key, label]) => {
        const value = key === "voucherCode" && voucherField ? voucherField : formatValue(key, action.preview[key], action.preview.serviceType);
        return value ? <div key={key} className={key === "amount" ? "my-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-3 py-3" : "grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-outline-variant/20 py-2.5 last:border-0 sm:grid-cols-[100px_minmax(0,1fr)]"}>
          <dt className={`text-xs leading-5 text-on-surface-variant ${key === "amount" ? "font-medium" : ""}`}>{key === "voucherCode" && action.tool === "create_booking" ? "Mã giảm giá" : key === "amount" && action.preview.serviceType === "variable_price" ? "Tiền đặt cọc" : label}</dt>
          <dd className={`min-w-0 whitespace-pre-wrap break-words leading-5 [overflow-wrap:anywhere] ${key === "amount" ? "text-2xl font-semibold leading-8 tracking-tight text-primary tabular-nums" : "text-[13px] font-medium"}`}>{value}</dd>
        </div> : null;
      })}
    </dl>
    {Array.isArray(action.preview.customerAttachments) && action.preview.customerAttachments.length > 0 && <div className="px-4 pb-4">
      <p className="mb-2 text-xs text-on-surface-variant">{action.tool === "create_booking" ? "Ảnh hiện trạng gửi kèm đơn" : "Ảnh đính kèm yêu cầu"}</p>
      <div className="grid grid-cols-4 gap-2">{action.preview.customerAttachments.filter((url): url is string => typeof url === "string" && url.startsWith("https://")).map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`Mở ảnh hiện trạng ${index + 1}`} className="overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
        <img src={url} alt={`Ảnh hiện trạng ${index + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
      </a>)}</div>
    </div>}
    {action.booking && <div className="border-t border-outline-variant/30 p-4">
      <p className="mb-2 text-xs text-on-surface-variant">Mã đơn: {action.booking.orderCode ?? action.booking.orderId}</p>
      <Link className="inline-flex min-h-11 items-center gap-2 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" to={`/customer/bookings/${action.booking.orderId}`}>Xem đơn và trạng thái hiện tại<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>}
    {!readOnly && onDecision && <div className="border-t border-outline-variant/30 p-4">
      {beforeDecision}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] leading-5 text-on-surface-variant"><Clock3 size={13} aria-hidden="true" />Có hiệu lực đến {new Date(action.expiresAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.</p>
      <div className="mt-3 grid grid-cols-[1fr_1.5fr] gap-2">
        <button type="button" disabled={disabled} onClick={() => onDecision("REJECT")} className="min-h-12 rounded-xl border border-outline-variant/70 px-3 py-2 font-medium transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">Từ chối</button>
        <button type="button" disabled={disabled || confirmDisabled} onClick={() => onDecision("CONFIRM")} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 font-semibold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"><Check size={17} aria-hidden="true" />{expired ? "Kiểm tra lại thông tin" : "Xác nhận"}</button>
      </div>
    </div>}
  </section>;
}
