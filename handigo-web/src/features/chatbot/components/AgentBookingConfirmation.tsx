import { BookingPolicyConsent } from "@/features/booking/components/BookingPolicyConsent";
import { useBookingPolicies } from "@/features/booking/hooks/useBookingPolicies";
import type { AgentBookingValues, AgentConfirmation, AgentPolicyConsent, AgentSession } from "../types/agent.types";
import { AgentConfirmationCard } from "./AgentConfirmationCard";
import type { AgentBookingTool } from "./AgentBookingTools";
import { CalendarDays, ChevronDown, CreditCard, MapPin, Minus, PencilLine, Ticket } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/common/Modal";

const voucherLabel = (voucher: NonNullable<NonNullable<AgentSession["bookingDraft"]>["availableVouchers"]>[number]) =>
  `Giảm ${voucher.discountType === "PERCENT" && typeof voucher.discountValue === "number"
    ? `${voucher.discountValue.toLocaleString("vi-VN")}%` : `${(voucher.discountValue ?? voucher.discountAmount).toLocaleString("vi-VN")} đ`}`;

export function AgentBookingConfirmation({ action, values, disabled, onDecision, onOpenTool, vouchers = [], onVoucherChange }: {
  action: AgentConfirmation; values?: AgentBookingValues; disabled: boolean;
  onDecision?: (decision: "CONFIRM" | "REJECT", policyConsent?: AgentPolicyConsent) => void; onOpenTool: (tool: AgentBookingTool) => void;
  vouchers?: NonNullable<AgentSession["bookingDraft"]>["availableVouchers"];
  onVoucherChange?: (code: string | null) => Promise<void>;
}) {
  const policies = useBookingPolicies(action.actionId);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [savingVoucher, setSavingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const selectedVoucher = typeof action.preview.voucherCode === "string" ? action.preview.voucherCode : null;
  const appliedVoucher = vouchers.find((voucher) => voucher.code === selectedVoucher);
  const selectVoucher = async (code: string | null) => {
    if (disabled || savingVoucher || !onVoucherChange) return;
    if (code === selectedVoucher) { setVoucherOpen(false); return; }
    setSavingVoucher(true); setVoucherError("");
    try { await onVoucherChange(code); setVoucherOpen(false); }
    catch { setVoucherError("Chưa cập nhật được mã giảm giá. Đóng danh sách và chọn Thử lại trong chat để tiếp tục."); }
    finally { setSavingVoucher(false); }
  };
  const canEditQuantity = values?.uniformQuantity !== undefined || Boolean(values?.selectedOptions?.length)
    || typeof action.preview.quantity === "number";
  const edits: Array<{ tool: AgentBookingTool; label: string }> = [
    ...(canEditQuantity ? [{ tool: "quantity" as const, label: "Số lượng" }] : []),
    { tool: "address", label: "Địa chỉ" }, { tool: "schedule", label: "Ngày giờ" }, { tool: "payment", label: "Thanh toán" },
  ];
  return <><AgentConfirmationCard action={action} disabled={disabled || voucherOpen || savingVoucher} confirmDisabled={!policies.accepted}
    voucherField={vouchers.length > 0 && onVoucherChange ? <button type="button" aria-label="Chọn mã giảm giá" aria-haspopup="dialog"
      disabled={disabled || savingVoucher} onClick={() => { setVoucherError(""); setVoucherOpen(true); }}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-outline-variant/50 px-3 text-left text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50">
      <span>{selectedVoucher ? appliedVoucher ? voucherLabel(appliedVoucher) : "Đã áp dụng ưu đãi" : "Không dùng voucher"}</span><ChevronDown size={15} aria-hidden="true" className="shrink-0 text-primary" />
    </button> : undefined}
    onDecision={(decision) => { if (decision === "REJECT" || policies.accepted) onDecision?.(decision,
      decision === "CONFIRM" && policies.policies?.version ? { accepted: true, version: policies.policies.version } : undefined); }}
    beforeDecision={<>
      <div className="mb-3 space-y-2.5"><p className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant"><PencilLine size={13} aria-hidden="true" />Sửa thông tin đặt lịch</p>
        <div className="grid grid-cols-2 gap-2">{edits.map((edit) => {
          const Icon = edit.tool === "quantity" ? Minus : edit.tool === "address" ? MapPin : edit.tool === "schedule" ? CalendarDays : CreditCard;
          return <button key={edit.tool} type="button" disabled={disabled}
          onClick={() => onOpenTool(edit.tool)} className="flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant/50 px-3 text-left text-xs font-medium text-on-surface transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Icon size={15} aria-hidden="true" className="shrink-0 text-primary" />{edit.label}</button>;
        })}</div>
      </div>
      <BookingPolicyConsent policies={policies.policies} loading={policies.loading} error={policies.error}
        accepted={policies.accepted} disabled={disabled} onChange={policies.setAccepted} onRetry={policies.retry}
        depositAmount={action.preview.serviceType === "variable_price" && typeof action.preview.originalAmount === "number" ? action.preview.originalAmount : undefined}
        payableDeposit={action.preview.serviceType === "variable_price" && typeof action.preview.amount === "number" ? action.preview.amount : undefined} />
    </>} />
    <Modal open={voucherOpen} title="Chọn mã giảm giá" size="sm" onClose={() => { if (!savingVoucher) setVoucherOpen(false); }}>
      <div className="space-y-3" aria-busy={savingVoucher}>
        <p className="text-sm text-on-surface-variant">Chọn một mã để cập nhật số tiền trong form xác nhận.</p>
        <button type="button" aria-pressed={!selectedVoucher} disabled={disabled || savingVoucher} onClick={() => void selectVoucher(null)}
          className="min-h-12 w-full rounded-xl border border-outline-variant px-4 py-3 text-left text-sm font-medium aria-pressed:border-primary aria-pressed:bg-primary/5 disabled:opacity-50">Không dùng voucher</button>
        {vouchers.map((voucher) => <button key={voucher.code} type="button" aria-pressed={selectedVoucher === voucher.code}
          disabled={disabled || savingVoucher} onClick={() => void selectVoucher(voucher.code)}
          className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-outline-variant px-4 py-3 text-left aria-pressed:border-primary aria-pressed:bg-primary/5 disabled:opacity-50">
          <Ticket size={20} aria-hidden="true" className="shrink-0 text-primary" />
          <span className="min-w-0"><span className="block text-sm font-semibold">{voucher.code}</span>
            <span className="block text-sm">{voucherLabel(voucher)}</span>
            <span className="block text-xs text-on-surface-variant">{voucher.name}</span></span>
        </button>)}
        {savingVoucher && <p role="status" className="text-sm">Đang kiểm tra mã và cập nhật số tiền…</p>}
        {voucherError && <p role="alert" className="text-sm text-error">{voucherError}</p>}
      </div>
    </Modal></>;
}
