import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { AgentSession, AgentSend, AgentBookingAction } from "../types/agent.types";
import type { AgentBookingTool } from "./AgentBookingTools";
import { getAgentConversationFlow } from "../utils/agentConversationFlow";
import { ArrowUpRight, CalendarDays, ChevronDown, CirclePlus, FileText, History, MapPin, Pause, Play, RotateCw, Search, UserRound, Wallet } from "lucide-react";

export function AgentBookingActions({ session, disabled, onOpenTool, onSend, onCheckPayment }: {
  session?: AgentSession | null; disabled: boolean; onOpenTool: (tool: AgentBookingTool) => void;
  onSend: AgentSend; onCheckPayment?: (orderId: string) => void;
}) {
  const draft = session?.bookingDraft;
  const pending = session?.pendingConfirmation;
  const buttonClass = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-primary";
  const send = (message: string, action?: AgentBookingAction) => { void onSend(message, undefined, action).catch(() => undefined); };
  const update = (message: string, mode: "pause" | "resume" | "discard") => send(message, { type: "update", revision: draft?.revision ?? 0, patch: { mode } });
  const options = (label: string, children: ReactNode) => <details className="group relative shrink-0" onKeyDown={(event) => {
    if (event.key === "Escape") {
      event.preventDefault(); event.currentTarget.removeAttribute("open"); event.currentTarget.querySelector("summary")?.focus();
    }
  }} onClick={(event) => {
    if ((event.target as HTMLElement).closest("button,a")) event.currentTarget.removeAttribute("open");
  }} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute("open");
  }}>
    <summary className={`${buttonClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
      {label}<ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
    </summary>
    <div className="absolute bottom-full right-0 z-10 mb-2 grid max-h-[min(45dvh,320px)] w-60 max-w-[calc(100vw-3rem)] gap-1 overflow-y-auto overscroll-contain rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-2 shadow-lg [&>button]:justify-start [&>button]:whitespace-normal [&>button]:border-transparent [&>button]:text-left [&>a]:justify-start [&>a]:border-transparent">{children}</div>
  </details>;
  const row = (children: ReactNode, label: string) => <div aria-label={label}
    className="flex min-w-0 items-center justify-end gap-2 border-t border-outline-variant/25 px-3 py-2 sm:px-4">{children}</div>;

  // Màn chào và các thẻ trong hội thoại đã có lựa chọn cho bước tiếp theo.
  if (!session?.messages.length || session.requiresNewSession || session.requiresReconciliation || (pending && pending.tool !== "create_booking")) return null;
  const dialogue = session.messages.findLast((message) => !message._id.startsWith("order-event:") && !message._id.startsWith("booking:"));
  if (!pending && !session.rebookProposal && (dialogue?.choiceGroups?.length || dialogue?.bookingSearch)) return null;
  const flow = getAgentConversationFlow(session);
  const otherTask = !["booking", "general"].includes(flow);
  if (flow === "history" && !session.rebookProposal) return null;
  if (!pending && !session.rebookProposal && ["support", "complaint"].includes(flow)) {
    const confirmation = session.messages.findLast((message) => message.confirmation)?.confirmation;
    const succeeded = confirmation?.status === "SUCCEEDED" && (flow === "support" ? /support_ticket/.test(confirmation.tool) : /complaint/.test(confirmation.tool));
    return session.state === "COMPLETED" || succeeded ? row(<Link className={buttonClass} to="/customer/support"><ArrowUpRight aria-hidden="true" />{flow === "complaint" ? "Xem khiếu nại của tôi" : "Xem yêu cầu hỗ trợ"}</Link>, "Theo dõi hỗ trợ và khiếu nại") : null;
  }
  const restore = session.draftBackup && !draft?.orderId ? <button type="button" className={buttonClass} disabled={disabled}
    onClick={() => send("Quay lại bản nháp trước.", { type: "restore_draft", backupId: session.draftBackup!.id })}><RotateCw aria-hidden="true" />Quay lại bản nháp trước</button> : null;

  if (session.rebookProposal) return row(<>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Giữ bản nháp đang soạn.", { type: "rebook_decision", proposalId: session.rebookProposal!.id, accept: false })}>Giữ bản đang soạn</button>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Chuyển sang đặt lại đơn cũ.", { type: "rebook_decision", proposalId: session.rebookProposal!.id, accept: true })}>Chuyển sang đặt lại</button>
  </>, "Chọn bản nháp cần tiếp tục");
  if (draft?.status === "paused" && !otherTask) return row(<>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => update("Tiếp tục bản nháp đang đặt.", "resume")}><Play aria-hidden="true" />Tiếp tục bản nháp</button>
    {options("Tùy chọn bản nháp", <><button type="button" className={buttonClass} disabled={disabled} onClick={() => update("Bỏ bản nháp đang đặt.", "discard")}>Bỏ bản nháp</button>{restore}</>)}
  </>, "Hành động với bản nháp tạm dừng");

  if (draft?.status === "active" && (pending || !otherTask)) {
    const missing = draft.missing.join(" ").toLocaleLowerCase("vi-VN");
    const needsAddress = !draft.values?.addressId || /địa chỉ/.test(missing);
    const needsSchedule = !needsAddress && /ngày|giờ hẹn|lịch hẹn/.test(missing);
    const needsProvider = !needsAddress && !needsSchedule && /chuyên gia|thợ/.test(missing);
    const needsPayment = !needsAddress && !needsSchedule && !needsProvider && /thanh toán|tiền cọc/.test(missing);
    const canChooseProvider = Boolean(draft.values?.serviceId && draft.values?.addressId);
    const primaryTool = needsAddress ? "address" : needsSchedule ? "schedule" : needsProvider && canChooseProvider ? "providers" : needsPayment ? "payment" : undefined;
    const primaryLabel = primaryTool === "address" ? "Chọn địa chỉ" : primaryTool === "schedule" ? "Chọn ngày giờ"
      : primaryTool === "providers" ? "Chọn thợ phù hợp" : "Chọn thanh toán";
    return row(<>
      {!pending && primaryTool && draft.values?.serviceId && <button type="button" className={buttonClass} disabled={disabled}
        onClick={() => onOpenTool(primaryTool)}>{primaryLabel}</button>}
      {!pending && !draft.missing.length && <button type="button" className={buttonClass} disabled={disabled}
        onClick={() => update("Tiếp tục bản nháp đang đặt.", "resume")}><Play aria-hidden="true" />Tiếp tục đặt lịch</button>}
      {options("Tùy chọn đặt lịch", <>
        {!pending && primaryTool !== "address" && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("address")}><MapPin aria-hidden="true" />Chọn địa chỉ khác</button>}
        {!pending && primaryTool !== "schedule" && draft.values?.serviceId && draft.values?.addressId && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("schedule")}><CalendarDays aria-hidden="true" />Chọn ngày giờ</button>}
        {canChooseProvider && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("providers")}><UserRound aria-hidden="true" />Xem thợ và hồ sơ</button>}
        {!pending && draft.values?.serviceId && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Tôi muốn chọn lại thợ từng phục vụ.")}><History aria-hidden="true" />Thợ từng đặt</button>}
        {draft.hasDraftAddress && <button type="button" className={buttonClass} disabled={disabled}
          onClick={() => send(draft.values?.saveAddressToBook === false ? "Lưu địa chỉ mới khi đặt đơn thành công." : "Chỉ dùng địa chỉ này một lần, không lưu vào sổ địa chỉ.",
            { type: "update", revision: draft.revision, patch: { saveAddressToBook: draft.values?.saveAddressToBook === false } })}>
          <MapPin aria-hidden="true" />{draft.values?.saveAddressToBook === false ? "Cho phép lưu địa chỉ" : "Dùng địa chỉ một lần"}</button>}
        {draft.values?.paymentMethod === "wallet" && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("wallet")}><Wallet aria-hidden="true" />Nạp ví</button>}
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => update("Tạm dừng bản nháp đang đặt.", "pause")}><Pause aria-hidden="true" />Tạm dừng</button>{restore}
      </>)}
    </>, "Hành động với bản nháp đặt lịch");
  }

  const capabilities = session.orderActions;
  const orderId = capabilities?.orderId ?? session.viewedOrder?.orderId ?? draft?.orderId ?? session.payment?.orderId;
  if (orderId) {
    const samePayment = session.payment?.orderId === orderId;
    if (samePayment && capabilities?.payment && ["booking", "general"].includes(flow)) return null;
    const detail = <Link className={buttonClass} to={`/customer/bookings/${orderId}`}><ArrowUpRight aria-hidden="true" />Chi tiết đơn</Link>;
    const latestConfirmation = session.messages.findLast((message) => message.confirmation)?.confirmation;
    const quotationRejected = latestConfirmation?.tool === "reject_booking_quotation" && latestConfirmation.status === "SUCCEEDED";
    if (flow === "feedback") return capabilities?.feedback ? row(<button type="button" className={buttonClass} disabled={disabled}
      onClick={() => onOpenTool("feedback")}>Đánh giá dịch vụ</button>, "Hành động đánh giá dịch vụ") : row(detail, "Chi tiết đơn đang đánh giá");
    if (flow === "quotation") return row(<>
      {quotationRejected && capabilities?.refunds ? <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Tra hoàn tiền đơn ${orderId}.`)}><Wallet aria-hidden="true" />Tra hoàn tiền</button>
        : capabilities?.quotation && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Xem báo giá đơn ${orderId}.`)}><FileText aria-hidden="true" />Xem báo giá</button>}{detail}
    </>, "Hành động với báo giá");
    if (flow === "refund") return row(<>
      {capabilities?.refunds && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Tra hoàn tiền đơn ${orderId}.`)}><Wallet aria-hidden="true" />Tra hoàn tiền</button>}{detail}
    </>, "Hành động với khoản hoàn");
    if (flow === "cancellation") return row(<>
      {capabilities?.refunds && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Tra hoàn tiền đơn ${orderId}.`)}><Wallet aria-hidden="true" />Tra hoàn tiền</button>}{detail}
    </>, "Theo dõi hủy đơn và hoàn tiền");
    if (flow === "reassignment") return row(<>
      {capabilities?.provider && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Xem thợ thực hiện đơn ${orderId}.`, { type: "provider", orderId })}><UserRound aria-hidden="true" />Thợ thực hiện</button>}{detail}
    </>, "Theo dõi thợ của đơn đang đổi");
    if (flow === "provider") return session.assignedProvider ? null : capabilities?.provider ? row(<button type="button" className={buttonClass} disabled={disabled}
      onClick={() => send(`Xem thợ thực hiện đơn ${orderId}.`, { type: "provider", orderId })}><UserRound aria-hidden="true" />Thợ thực hiện</button>, "Tra cứu thợ thực hiện") : row(detail, "Chi tiết đơn đang xem");
    if (flow === "payment") return samePayment ? null : row(<>
      {capabilities?.payment && onCheckPayment && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onCheckPayment(orderId)}><RotateCw aria-hidden="true" />Kiểm tra thanh toán</button>}{detail}
    </>, "Hành động thanh toán");
    const showFeedback = capabilities?.feedback;
    const showRefund = capabilities?.refunds;
    const showProvider = !showRefund && !showFeedback && capabilities?.provider && !session.assignedProvider && !capabilities.payment;
    return row(<>
      {showRefund ? <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Tra hoàn tiền đơn ${orderId}.`)}><Wallet aria-hidden="true" />Tra hoàn tiền</button>
        : showFeedback ? <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("feedback")}>Đánh giá dịch vụ</button>
        : capabilities?.payment && !samePayment && onCheckPayment ? <button type="button" className={buttonClass} disabled={disabled} onClick={() => onCheckPayment(orderId)}><RotateCw aria-hidden="true" />Kiểm tra thanh toán</button>
        : showProvider ? <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Xem thợ thực hiện đơn ${orderId}.`, { type: "provider", orderId })}><UserRound aria-hidden="true" />Thợ thực hiện</button> : null}
      {options("Tùy chọn đơn hàng", <>
        <p className="break-words px-3 py-2 text-xs text-on-surface-variant">{capabilities?.orderCode ?? session.viewedOrder?.orderCode ?? session.payment?.orderCode ?? "Đơn đang xem"}</p>
        <Link className={buttonClass} to={`/customer/bookings/${orderId}`}><ArrowUpRight aria-hidden="true" />Xem đơn hàng</Link>
        {capabilities?.provider && !showProvider && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Xem thợ thực hiện đơn ${orderId}.`, { type: "provider", orderId })}><UserRound aria-hidden="true" />Thợ thực hiện</button>}
        {capabilities?.feedback && !showFeedback && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("feedback")}>Đánh giá dịch vụ</button>}
        {capabilities?.quotation && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Xem báo giá đơn ${orderId}.`)}><FileText aria-hidden="true" />Xem báo giá</button>}
        {capabilities?.payment && samePayment && !["active", "paused"].includes(draft?.status ?? "") && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("wallet")}><Wallet aria-hidden="true" />Nạp ví cho đơn này</button>}
        {capabilities?.rebook && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Đặt lại đơn ${orderId}, tìm thợ phù hợp.`)}><History aria-hidden="true" />Đặt lại đơn này</button>}
      </>)}
    </>, "Hành động với đơn đang xem");
  }
  if (otherTask) return null;
  return row(<>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Giúp tôi chọn dịch vụ tại nhà.")}><CirclePlus aria-hidden="true" />Đặt dịch vụ</button>
    {options("Tra cứu", <>
      <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Tôi muốn tìm đơn cũ.")}><Search aria-hidden="true" />Tìm đơn cũ</button>
      <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Tôi muốn chọn lại thợ từng phục vụ.")}><History aria-hidden="true" />Thợ từng đặt</button>
    </>)}
  </>, "Hành động với trợ lý");
}
