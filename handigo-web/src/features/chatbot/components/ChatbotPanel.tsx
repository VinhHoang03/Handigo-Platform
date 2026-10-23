import { Skeleton } from "@/components/common/Skeleton";
import type { ChatbotAudience, ChatbotMessage } from "../types/chatbot.types";
import { ChatbotComposer } from "./ChatbotComposer";
import { ChatbotMessageList } from "./ChatbotMessageList";
import { ChatbotAvatar } from "./ChatbotAvatar";
import { ArrowLeft, History, LoaderCircle, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import type { AgentConfirmation, AgentPayment, AgentSession, AgentSend, AgentPolicyConsent } from "../types/agent.types";
import { AgentPaymentCard } from "./AgentPaymentCard";
import { AgentConfirmationCard } from "./AgentConfirmationCard";
import { AgentBookingConfirmation } from "./AgentBookingConfirmation";
import { AgentBookingTools, type AgentBookingTool } from "./AgentBookingTools";
import { AgentBookingActions } from "./AgentBookingActions";
import { AgentWalletResumeCard } from "./AgentWalletResumeCard";
import { AgentAssignedProviderCard } from "./AgentAssignedProviderCard";
import type { AgentWalletResume } from "../utils/agentWalletResume";

const getAudienceLabel = (audience: ChatbotAudience) => {
  if (audience === "CUSTOMER") return "Hỗ trợ dành cho khách hàng";
  if (audience === "PROVIDER") return "Hỗ trợ dành cho nhà cung cấp";
  return "Hỗ trợ sử dụng Handigo";
};

export function ChatbotPanel({
  audience,
  messages,
  isLoading,
  isReplying,
  activity,
  error,
  availabilityMessage,
  onClose,
  onRetry,
  onSend,
  onUploadAttachment,
  pendingConfirmation,
  onDecision,
  onNewSession,
  taskBlocked = false,
  payment,
  paymentMessageId,
  onCheckPayment,
  onChangePaymentMethod,
  onCancelPayment,
  onContinue,
  history,
  onToggleHistory,
  agentSession,
  userId,
  walletResume,
  onResumeWallet,
  onDismissWallet,
}: {
  audience: ChatbotAudience;
  messages: ChatbotMessage[];
  isLoading: boolean;
  isReplying: boolean;
  activity?: string;
  error: string;
  availabilityMessage: string;
  onClose: () => void;
  onRetry: () => void;
  onSend: AgentSend;
  onUploadAttachment?: (file: File) => Promise<string>;
  pendingConfirmation?: AgentConfirmation | null;
  onDecision?: (decision: "CONFIRM" | "REJECT", policyConsent?: AgentPolicyConsent) => void;
  onNewSession?: () => void;
  taskBlocked?: boolean;
  payment?: AgentPayment | null;
  paymentMessageId?: string;
  onCheckPayment?: (orderId: string) => void;
  onChangePaymentMethod?: (orderId: string) => void;
  onCancelPayment?: (orderId: string, paymentId: string) => void;
  onContinue?: () => void;
  history?: ReactNode;
  onToggleHistory?: () => void;
  agentSession?: AgentSession | null;
  userId?: string;
  walletResume?: AgentWalletResume | null;
  onResumeWallet?: () => Promise<void>;
  onDismissWallet?: () => void;
}) {
  const toolsAnchorRef = useRef<HTMLDivElement>(null);
  const [bookingTool, setBookingTool] = useState<{ tool: AgentBookingTool; fingerprint: string } | null>(null);
  const [attachmentEdit, setAttachmentEdit] = useState<string | null>(null);
  const fingerprint = `${agentSession?.sessionId}:${agentSession?.bookingDraft?.revision}:${pendingConfirmation?.actionId ?? ""}`;
  const attachmentsDirty = attachmentEdit === fingerprint;
  const controlsDisabled = isLoading || isReplying || taskBlocked || Boolean(error) || Boolean(availabilityMessage);
  const statusLabel = isLoading ? "Đang tải cuộc trò chuyện" : isReplying ? activity || "Đang xử lý yêu cầu"
    : error ? "Cần thử lại yêu cầu" : taskBlocked ? "Cần kiểm tra kết quả"
    : pendingConfirmation ? "Chờ bạn xác nhận" : "";
  const openTool = (tool: AgentBookingTool) => {
    if (controlsDisabled || !agentSession || !userId || (pendingConfirmation && pendingConfirmation.tool !== "create_booking")) return;
    setBookingTool({ tool, fingerprint });
  };
  const renderConfirmation = (action: AgentConfirmation, readOnly: boolean) => audience === "CUSTOMER" && action.tool === "create_booking" && !readOnly
    ? <AgentBookingConfirmation key={action.actionId} action={action} values={agentSession?.bookingDraft?.values}
      disabled={isReplying || controlsDisabled || attachmentsDirty} onDecision={onDecision} onOpenTool={openTool} />
    : <AgentConfirmationCard action={action} readOnly={readOnly} disabled={isReplying || controlsDisabled || attachmentsDirty} onDecision={onDecision} />;
  return (
    <aside
      aria-label="Trợ lý Handigo"
      className="fixed inset-x-2 bottom-2 z-[130] flex h-[min(780px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-[24px] border border-outline-variant/50 bg-surface-container-lowest shadow-[0_24px_80px_-16px_rgba(19,27,46,0.28),0_4px_16px_rgba(19,27,46,0.08)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(760px,calc(100dvh-3rem))] sm:w-[460px]"
    >
      <header className="shrink-0 border-b border-outline-variant/30 bg-surface-container-lowest px-4 py-4 text-on-surface sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ChatbotAvatar className="block h-12 w-12 shrink-0 rounded-2xl shadow-sm" />
            <div className="min-w-0">
              <h2 className="truncate font-headline-md text-xl font-bold tracking-tight">
                Trợ lý Handigo
              </h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {getAudienceLabel(audience)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onToggleHistory && <button type="button" onClick={onToggleHistory}
              disabled={isLoading || isReplying} aria-label={history ? "Quay lại cuộc trò chuyện" : "Mở lịch sử trò chuyện"}
              aria-pressed={Boolean(history)} title={history ? "Quay lại cuộc trò chuyện" : "Lịch sử trò chuyện"}
              className={`grid h-11 w-11 place-items-center rounded-xl transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 ${history ? "bg-primary/10 text-primary" : "text-on-surface-variant"}`}>
              {history ? <ArrowLeft aria-hidden="true" size={19} /> : <History aria-hidden="true" size={19} />}
            </button>}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trợ lý"
              title="Đóng trợ lý"
              className="grid h-11 w-11 place-items-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X aria-hidden="true" size={20} className="block" />
            </button>
          </div>
        </div>
      </header>
      {!history && statusLabel && <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant/20 bg-surface-container-low/60 px-4 py-2.5 text-xs text-on-surface-variant sm:px-5" role="status">
        {isLoading || isReplying ? <LoaderCircle size={13} aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none text-primary" />
          : <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${error || taskBlocked ? "bg-error" : "bg-primary"}`} />}
        <span className="min-w-0 flex-1 truncate">{statusLabel}</span>
      </div>}

      {history || (isLoading ? (
        <div
          className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-surface-container-low/40 p-5"
          role="status"
          aria-busy="true"
          aria-label="Đang tải cuộc trò chuyện"
        >
          <Skeleton className="h-16 w-3/5" rounded="rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-2/5" rounded="rounded-2xl" />
          <Skeleton className="h-14 w-1/2" rounded="rounded-2xl" />
        </div>
      ) : (
        <ChatbotMessageList
          onSend={onSend}
          choicesDisabled={attachmentsDirty || taskBlocked || Boolean(pendingConfirmation) || Boolean(availabilityMessage) || Boolean(error)}
          bookingVoucherChoicesEnabled={audience === "CUSTOMER" && pendingConfirmation?.tool === "create_booking" && !attachmentsDirty && !controlsDisabled}
          messages={messages}
          isReplying={isReplying}
          activity={activity}
          audience={audience}
          pendingActionId={pendingConfirmation?.actionId}
          confirmationsDisabled={isLoading || taskBlocked || Boolean(error) || Boolean(availabilityMessage)}
          onDecision={onDecision}
          renderConfirmation={renderConfirmation}
          renderAfterMessage={(message) => payment && onCheckPayment && message._id === paymentMessageId
            ? <AgentPaymentCard payment={payment} disabled={isReplying || isLoading || Boolean(pendingConfirmation) || Boolean(error)} onCheck={onCheckPayment} onChangeMethod={taskBlocked || availabilityMessage ? undefined : onChangePaymentMethod} onCancel={taskBlocked || availabilityMessage ? undefined : onCancelPayment} />
            : null}
        >
          {pendingConfirmation && onDecision && !messages.some((message) => message.confirmation?.actionId === pendingConfirmation.actionId) && (
            renderConfirmation(pendingConfirmation, false)
          )}
          {payment && onCheckPayment && !messages.some((message) => message._id === paymentMessageId) && (
            <AgentPaymentCard payment={payment} disabled={isReplying || isLoading || Boolean(pendingConfirmation) || Boolean(error)} onCheck={onCheckPayment} onChangeMethod={taskBlocked || availabilityMessage ? undefined : onChangePaymentMethod} onCancel={taskBlocked || availabilityMessage ? undefined : onCancelPayment} />
          )}
          {walletResume && walletResume.sessionId === agentSession?.sessionId && onResumeWallet && onDismissWallet && (
            <AgentWalletResumeCard key={walletResume.depositOrderCode} context={walletResume}
              disabled={controlsDisabled || Boolean(pendingConfirmation && pendingConfirmation.tool !== "create_booking")}
              onContinue={onResumeWallet} onDismiss={onDismissWallet} />
          )}
          {agentSession?.assignedProvider && <AgentAssignedProviderCard key={`${agentSession.assignedProvider.orderId}:${agentSession.assignedProvider.checkedAt}`}
            value={agentSession.assignedProvider} disabled={controlsDisabled || Boolean(pendingConfirmation) || attachmentsDirty} onSend={onSend} />}
        </ChatbotMessageList>
      ))}

      {!history && onContinue && !pendingConfirmation && (
        <button type="button" onClick={onContinue} disabled={isReplying || isLoading} className="mx-4 mb-2 shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">{taskBlocked ? "Kiểm tra kết quả tạo đơn" : "Tiếp tục yêu cầu"}</button>
      )}
      <div ref={toolsAnchorRef} className="shrink-0">
        {!history && audience === "CUSTOMER" && <div className="border-t border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 sm:px-4 [&_button]:shrink-0 [&_a]:shrink-0">
          <AgentBookingActions session={agentSession} disabled={attachmentsDirty || isLoading || isReplying || Boolean(error) || Boolean(availabilityMessage)}
            onOpenTool={openTool} onSend={onSend} onCheckPayment={onCheckPayment} />
        </div>}
      </div>
      {availabilityMessage && (
        <div
          className="border-t border-primary/15 bg-primary-fixed px-4 py-3 text-sm leading-5 text-on-primary-fixed"
          role="status"
        >
          {availabilityMessage}
        </div>
      )}
      {error && (
        <div
          className="flex items-center justify-between gap-3 border-t border-error/15 bg-error-container px-4 py-2 text-xs text-on-error-container"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 font-bold underline"
          >
            Thử lại
          </button>
        </div>
      )}
      {!history && <ChatbotComposer
        key={agentSession?.sessionId ?? "new"}
        disabled={isLoading || isReplying || Boolean(availabilityMessage) || Boolean(pendingConfirmation && pendingConfirmation.tool !== "create_booking") || taskBlocked}
        onSend={onSend}
        onUploadAttachment={onUploadAttachment}
        attachmentUrls={agentSession?.bookingDraft?.status === "active" ? agentSession.bookingDraft.values?.customerAttachments : undefined}
        attachmentPurpose={agentSession?.bookingDraft?.status === "active" ? "booking" : "general"}
        onAttachmentChange={(dirty) => setAttachmentEdit(dirty ? fingerprint : null)}
        onNewSession={onNewSession}
        resetDisabled={isLoading || isReplying || Boolean(pendingConfirmation) || taskBlocked}
        voiceEnabled={audience === "CUSTOMER"}
      />}
      {!history && bookingTool?.fingerprint === fingerprint && agentSession && userId && <AgentBookingTools
        key={`${fingerprint}:${bookingTool.tool}`} tool={bookingTool.tool} session={agentSession} userId={userId}
        anchorRef={toolsAnchorRef} disabled={controlsDisabled} onClose={() => setBookingTool(null)} onSend={onSend} />}
    </aside>
  );
}
