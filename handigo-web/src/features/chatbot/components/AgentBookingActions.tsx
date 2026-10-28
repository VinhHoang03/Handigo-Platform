import { Link } from "react-router-dom";
import type { AgentSession, AgentSend, AgentBookingAction } from "../types/agent.types";
import type { AgentBookingTool } from "./AgentBookingTools";
import { ArrowUpRight, CalendarDays, CirclePlus, FileText, History, MapPin, Pause, Play, RotateCw, Search, UserRound, Wallet } from "lucide-react";

export function AgentBookingActions({ session, disabled, onOpenTool, onSend, onCheckPayment }: {
  session?: AgentSession | null; disabled: boolean; onOpenTool: (tool: AgentBookingTool) => void;
  onSend: AgentSend; onCheckPayment?: (orderId: string) => void;
}) {
  const draft = session?.bookingDraft;
  const pending = session?.pendingConfirmation;
  const buttonClass = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-primary";
  const rowClass = "flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]";
  const send = (message: string, action?: AgentBookingAction) => { void onSend(message, undefined, action).catch(() => undefined); };
  const update = (message: string, mode: "pause" | "resume" | "discard") => send(message, { type: "update", revision: draft?.revision ?? 0, patch: { mode } });
  const lookupActions = <>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Tôi muốn tìm đơn cũ.")}><Search aria-hidden="true" />Tìm đơn cũ</button>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Tôi muốn chọn lại thợ từng phục vụ.")}><History aria-hidden="true" />Thợ từng đặt</button>
  </>;
  if (!session) return <div className={rowClass} aria-label="Hành động với trợ lý" tabIndex={0}>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Giúp tôi chọn dịch vụ tại nhà.")}><CirclePlus aria-hidden="true" />Đặt dịch vụ</button>{lookupActions}
  </div>;
  if (session.requiresNewSession || (pending && pending.tool !== "create_booking")) return null;
  if (session.requiresReconciliation) return session.payment && onCheckPayment
    ? <button type="button" className={buttonClass} disabled={disabled} onClick={() => onCheckPayment(session.payment!.orderId)}><RotateCw aria-hidden="true" />Kiểm tra thanh toán</button> : null;
  if (session.rebookProposal) return <div className={rowClass} aria-label="Chọn bản nháp cần tiếp tục" tabIndex={0}>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Giữ bản nháp đang soạn.", { type: "rebook_decision", proposalId: session.rebookProposal!.id, accept: false })}>Giữ bản đang soạn</button>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Chuyển sang đặt lại đơn cũ.", { type: "rebook_decision", proposalId: session.rebookProposal!.id, accept: true })}>Chuyển sang đặt lại</button>
  </div>;
  const capabilities = session.orderActions;
  const orderId = capabilities?.orderId ?? session.viewedOrder?.orderId ?? draft?.orderId ?? session.payment?.orderId;
  const orderActions = orderId ? <div className="space-y-1.5" aria-label="Đơn đang xem">
    <p className="text-xs text-on-surface-variant">Đơn đang xem: {capabilities?.orderCode ?? session.viewedOrder?.orderCode ?? session.payment?.orderCode ?? "Mở chi tiết để kiểm tra"}</p>
    {capabilities?.reason && <p className="text-xs text-on-surface-variant">{capabilities.reason}</p>}
    <div className={rowClass} tabIndex={0}>
      <Link className={buttonClass} to={`/customer/bookings/${orderId}`}><ArrowUpRight aria-hidden="true" />Xem đơn hàng</Link>
      {capabilities?.provider && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Xem thợ thực hiện đơn ${orderId}.`, { type: "provider", orderId })}><UserRound aria-hidden="true" />Thợ thực hiện</button>}
      {capabilities?.feedback && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("feedback")}>Đánh giá dịch vụ</button>}
      {capabilities?.quotation && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Xem báo giá đơn ${orderId}.`)}><FileText aria-hidden="true" />Xem báo giá</button>}
      {capabilities?.refunds && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Tra hoàn tiền đơn ${orderId}.`)}><Wallet aria-hidden="true" />Tra hoàn tiền</button>}
      {capabilities?.payment && onCheckPayment && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onCheckPayment(orderId)}><RotateCw aria-hidden="true" />Kiểm tra thanh toán</button>}
      {capabilities?.payment && session.payment?.orderId === orderId && !["active", "paused"].includes(draft?.status ?? "")
        && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("wallet")}><Wallet aria-hidden="true" />Nạp ví cho đơn này</button>}
      {capabilities?.rebook && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(`Đặt lại đơn ${orderId}, tìm thợ phù hợp.`)}><History aria-hidden="true" />Đặt lại đơn này</button>}
    </div>
  </div> : null;
  const restore = session.draftBackup && !draft?.orderId ? <button type="button" className={buttonClass} disabled={disabled}
    onClick={() => send("Quay lại bản nháp trước.", { type: "restore_draft", backupId: session.draftBackup!.id })}><RotateCw aria-hidden="true" />Quay lại bản nháp trước</button> : null;
  if (draft?.status === "paused") return <>{orderActions}<div className={rowClass} aria-label="Hành động với bản nháp tạm dừng" tabIndex={0}>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => update("Tiếp tục bản nháp đang đặt.", "resume")}><Play aria-hidden="true" />Tiếp tục bản nháp</button>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => update("Bỏ bản nháp đang đặt.", "discard")}>Bỏ bản nháp</button>{restore}
  </div></>;
  if (draft?.status === "active") return <>{orderActions}<div className={rowClass} aria-label="Hành động với bản nháp đặt lịch" tabIndex={0}>
    {draft.hasDraftAddress && <button type="button" className={buttonClass} disabled={disabled}
      onClick={() => send(draft.values?.saveAddressToBook === false ? "Lưu địa chỉ mới khi đặt đơn thành công." : "Chỉ dùng địa chỉ này một lần, không lưu vào sổ địa chỉ.",
        { type: "update", revision: draft.revision, patch: { saveAddressToBook: draft.values?.saveAddressToBook === false } })}>
      <MapPin aria-hidden="true" />{draft.values?.saveAddressToBook === false ? "Cho phép lưu địa chỉ" : "Dùng địa chỉ một lần"}</button>}
    {!pending && <>
      <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("schedule")}><CalendarDays aria-hidden="true" />Chọn ngày giờ</button>
      <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("address")}><MapPin aria-hidden="true" />Chọn địa chỉ khác</button>
    </>}
    <button type="button" className={buttonClass} disabled={disabled || !draft.values?.serviceId || !draft.values?.addressId} onClick={() => onOpenTool("providers")}><UserRound aria-hidden="true" />Xem thợ và hồ sơ</button>
    {!pending && <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Tôi muốn chọn lại thợ từng phục vụ.")}><History aria-hidden="true" />Thợ từng đặt</button>}
    {draft.values?.paymentMethod === "wallet" && <button type="button" className={buttonClass} disabled={disabled} onClick={() => onOpenTool("wallet")}><Wallet aria-hidden="true" />Nạp ví</button>}
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => update("Tạm dừng bản nháp đang đặt.", "pause")}><Pause aria-hidden="true" />Tạm dừng</button>{restore}
  </div></>;
  if (orderId) return <>{orderActions}<div className={rowClass} aria-label="Hành động với đơn đã tạo" tabIndex={0}>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Tôi muốn đặt thêm dịch vụ mới.")}><CirclePlus aria-hidden="true" />Đặt thêm dịch vụ</button>
    {lookupActions}
  </div></>;
  return <div className={rowClass} aria-label="Hành động với trợ lý" tabIndex={0}>
    <button type="button" className={buttonClass} disabled={disabled} onClick={() => send("Giúp tôi chọn dịch vụ tại nhà.")}><CirclePlus aria-hidden="true" />Đặt dịch vụ</button>{lookupActions}
  </div>;
}
