import type { RefObject } from "react";
import type { AgentSession, AgentSend } from "../types/agent.types";
import { AgentBookingEditor, type AgentBookingEditMode } from "./AgentBookingEditor";
import { AgentBookingSchedule } from "./AgentBookingSchedule";
import { AgentBookingProviders } from "./AgentBookingProviders";
import { AgentWalletTopUp } from "./AgentWalletTopUp";
import { AgentBookingFeedback } from "./AgentBookingFeedback";

export type AgentBookingTool = AgentBookingEditMode | "schedule" | "providers" | "wallet" | "feedback";

export function AgentBookingTools({ tool, session, userId, anchorRef, disabled, onClose, onSend }: {
  tool: AgentBookingTool; session: AgentSession; userId: string; anchorRef: RefObject<HTMLDivElement | null>;
  disabled: boolean; onClose: () => void; onSend: AgentSend;
}) {
  const draft = session.bookingDraft;
  const preview = session.pendingConfirmation?.tool === "create_booking" ? session.pendingConfirmation.preview : undefined;
  const values = { ...draft?.values };
  if (tool === "feedback") {
    const orderId = session.orderActions?.orderId ?? session.viewedOrder?.orderId;
    return orderId ? <AgentBookingFeedback key={orderId} orderId={orderId} disabled={disabled} onSend={onSend} onClose={onClose} /> : null;
  }
  if (values.uniformQuantity === undefined && typeof preview?.quantity === "number") values.uniformQuantity = preview.quantity;
  if (tool === "wallet") {
    const orderId = draft && ["active", "paused"].includes(draft.status) ? undefined : session.orderActions?.orderId ?? session.viewedOrder?.orderId ?? draft?.orderId ?? session.payment?.orderId;
    const orderCode = session.orderActions?.orderId === orderId ? session.orderActions?.orderCode
      : session.viewedOrder?.orderId === orderId ? session.viewedOrder?.orderCode
      : session.payment?.orderId === orderId ? session.payment?.orderCode
      : session.messages.find((message) => message.confirmation?.booking?.orderId === orderId)?.confirmation?.booking?.orderCode;
    return <AgentWalletTopUp userId={userId} sessionId={session.sessionId} orderId={orderId} orderCode={orderCode} onClose={onClose} />;
  }
  if (tool === "schedule") return <AgentBookingSchedule revision={draft?.revision ?? 0} anchorRef={anchorRef} scheduledAt={values.scheduledAt} disabled={disabled} onClose={onClose} onSend={onSend} />;
  if (tool === "providers") return <AgentBookingProviders revision={draft?.revision ?? 0} values={values} anchorRef={anchorRef} disabled={disabled} onClose={onClose} onSend={onSend}
    draftCandidates={draft?.hasDraftAddress ? draft.providerCandidates ?? [] : undefined} />;
  return <AgentBookingEditor revision={draft?.revision ?? 0} mode={tool} values={values} preview={preview} disabled={disabled} onClose={onClose} onSend={onSend} />;
}
