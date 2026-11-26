import { Link } from "react-router-dom";
import type { AgentBookingAction, AgentSend, AgentSession } from "../types/agent.types";

const labels = { queued: "Chờ soạn", active: "Đang soạn", blocked: "Để lại", created: "Đã tạo đơn", skipped: "Đã bỏ" };
export function AgentBookingPlan({ session, disabled, onSend }: { session: AgentSession; disabled: boolean; onSend: AgentSend }) {
  const plan = session.bookingPlan;
  if (!plan) return null;
  const current = plan.items.find(item => item.id === plan.activeItemId);
  const blocked = disabled || session.requiresReconciliation || Boolean(session.pendingConfirmation && session.pendingConfirmation.tool !== "create_booking");
  const live = ["active", "paused"].includes(plan.status);
  const button = (action: Extract<AgentBookingAction, { type: "plan" }>["plan"]["action"], label: string, itemId?: string) =>
    <button type="button" disabled={blocked} className="min-h-11 rounded-lg border border-outline-variant px-3 text-xs disabled:opacity-50"
      onClick={() => { void onSend(`${label} trong danh sách đặt dịch vụ.`, undefined,
        { type: "plan", plan: { action, planId: plan.id, revision: plan.revision, ...(itemId ? { itemId } : {}) } }).catch(() => undefined); }}>{label}</button>;
  return <section aria-label="Danh sách yêu cầu đặt dịch vụ" tabIndex={0} className="mx-3 my-2 max-h-[min(36dvh,280px)] space-y-2 overflow-y-auto rounded-xl border border-outline-variant p-3 text-sm focus-visible:outline-2 focus-visible:outline-primary">
    <p className="font-semibold">Yêu cầu đặt dịch vụ ({plan.items.filter(item => item.status === "created").length}/{plan.items.length} đã tạo đơn)</p>
    <ol className="space-y-2">{plan.items.map(item => <li key={item.id}>
      <span>{item.label} · {labels[item.status]}</span>{item.orderId && <Link className="ml-2 text-primary underline" to={`/customer/bookings/${item.orderId}`}>{item.orderCode ?? "Chi tiết đơn"}</Link>}
      {live && item.status === "blocked" && <div>{button("resume", `Tiếp tục ${item.label}`, item.id)}</div>}
    </li>)}</ol>
    <p className="text-xs text-on-surface-variant">{plan.note}</p>
    {live && <div className="flex flex-wrap gap-2">
      {plan.status === "paused" ? button("resume", "Tiếp tục danh sách") : <>
        {current?.status === "active" ? <>{button("defer", "Để lại yêu cầu")}{button("skip", "Bỏ yêu cầu")}</>
          : button("next", "Yêu cầu tiếp theo")}
        {button("pause", "Tạm dừng danh sách")}
      </>}
      {button("cancel", "Bỏ các yêu cầu chưa tạo")}
    </div>}
  </section>;
}
