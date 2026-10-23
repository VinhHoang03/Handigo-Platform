import { BookingPolicyConsent } from "@/features/booking/components/BookingPolicyConsent";
import { useBookingPolicies } from "@/features/booking/hooks/useBookingPolicies";
import type { AgentBookingValues, AgentConfirmation, AgentPolicyConsent } from "../types/agent.types";
import { AgentConfirmationCard } from "./AgentConfirmationCard";
import type { AgentBookingTool } from "./AgentBookingTools";
import { CalendarDays, CreditCard, MapPin, Minus, PencilLine } from "lucide-react";

export function AgentBookingConfirmation({ action, values, disabled, onDecision, onOpenTool }: {
  action: AgentConfirmation; values?: AgentBookingValues; disabled: boolean;
  onDecision?: (decision: "CONFIRM" | "REJECT", policyConsent?: AgentPolicyConsent) => void; onOpenTool: (tool: AgentBookingTool) => void;
}) {
  const policies = useBookingPolicies(action.actionId);
  const canEditQuantity = values?.uniformQuantity !== undefined || Boolean(values?.selectedOptions?.length)
    || typeof action.preview.quantity === "number";
  const edits: Array<{ tool: AgentBookingTool; label: string }> = [
    ...(canEditQuantity ? [{ tool: "quantity" as const, label: "Số lượng" }] : []),
    { tool: "address", label: "Địa chỉ" }, { tool: "schedule", label: "Ngày giờ" }, { tool: "payment", label: "Thanh toán" },
  ];
  return <AgentConfirmationCard action={action} disabled={disabled} confirmDisabled={!policies.accepted}
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
    </>} />;
}
