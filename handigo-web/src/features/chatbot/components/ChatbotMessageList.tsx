import { Children, Fragment, useLayoutEffect, useRef, type ReactNode } from "react";
import type {
  ChatbotAudience,
  ChatbotMessage,
} from "../types/chatbot.types";
import { ArrowUpRight, Bot, Search, Wrench } from "lucide-react";
import { AgentChoiceGroups } from "./AgentChoiceGroups";
import { AgentConfirmationCard } from "./AgentConfirmationCard";
import type { AgentConfirmation } from "../types/agent.types";
import { agentDisplayText } from "../utils/agentDisplayText";
import { AgentBookingSearchResults } from "./AgentBookingSearchResults";

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

function AgentMessageContent({ content }: { content: string }) {
  const inline = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-semibold text-on-surface">{part.slice(2, -2)}</strong> : part);
  return <div className="space-y-2 break-words [overflow-wrap:anywhere]">
    {content.trim().split(/\n\s*\n/).map((paragraph, index) => {
      const lines = paragraph.split("\n");
      if (lines.every((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line))) {
        return <ul key={index} className="list-disc space-y-1 pl-5 marker:text-primary/70">
          {lines.map((line, lineIndex) => <li key={lineIndex}>{inline(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""))}</li>)}
        </ul>;
      }
      return <p key={index} className="whitespace-pre-wrap">{inline(paragraph)}</p>;
    })}
  </div>;
}

export function ChatbotMessageList({
  messages,
  isReplying,
  activity,
  audience,
  children,
  onSend,
  choicesDisabled = false,
  bookingVoucherChoicesEnabled = false,
  pendingActionId,
  confirmationsDisabled = false,
  onDecision,
  renderAfterMessage,
  renderConfirmation,
}: {
  messages: ChatbotMessage[];
  isReplying: boolean;
  activity?: string;
  audience: ChatbotAudience;
  children?: ReactNode;
  onSend?: (content: string) => Promise<void>;
  choicesDisabled?: boolean;
  bookingVoucherChoicesEnabled?: boolean;
  pendingActionId?: string;
  confirmationsDisabled?: boolean;
  onDecision?: (decision: "CONFIRM" | "REJECT") => void;
  renderAfterMessage?: (message: ChatbotMessage) => ReactNode;
  renderConfirmation?: (action: AgentConfirmation, readOnly: boolean) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestUserRef = useRef<HTMLDivElement>(null);
  const scrollMode = useRef<"bottom" | "turn" | "manual">("bottom");
  const automaticScrollTop = useRef<number | null>(null);
  const lastUserMessage = useRef<ChatbotMessage | undefined>(undefined);
  const latestUserMessage = messages.findLast((message) => message.sender === "user");
  const latestSearchId = messages.findLast((message) => message.sender === "assistant" && message.bookingSearch)?._id;
  const latestDialogue = audience === "CUSTOMER"
    ? messages.findLast((message) => !message._id.startsWith("order-event:") && !message._id.startsWith("booking:"))
    : messages.at(-1);
  const hasBookingForm = Boolean(renderConfirmation && messages.some((message) => message.confirmation?.tool === "create_booking"
    && message.confirmation.actionId === pendingActionId));

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const userMessageId = latestUserMessage?._id;
    const previous = lastUserMessage.current;
    const acknowledged = previous?._id.startsWith("pending-") && !userMessageId?.startsWith("pending-")
      && previous.content === latestUserMessage?.content;
    if (userMessageId && userMessageId !== previous?._id && !acknowledged) {
      scrollMode.current = previous || isReplying || messages.at(-1)?.sender === "user" ? "turn" : "bottom";
    }
    lastUserMessage.current = latestUserMessage;
    if (container && scrollMode.current !== "manual") {
      // Giữ đầu lượt mới trong tầm nhìn khi bản xác nhận bên dưới dài hơn khung chat.
      container.scrollTop = scrollMode.current === "turn" && latestUserRef.current
        ? container.scrollTop + latestUserRef.current.getBoundingClientRect().top - container.getBoundingClientRect().top
          - (parseFloat(window.getComputedStyle(container).paddingTop) || 0)
        : container.scrollHeight;
      automaticScrollTop.current = container.scrollTop;
    }
  }, [isReplying, messages, children, latestUserMessage]);

  if (!messages.length && !isReplying && Children.toArray(children).length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-surface-container-low/40 px-6 py-8 [scrollbar-width:thin]">
        <div className="my-auto w-full">
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-primary/10 bg-surface-container-lowest text-primary shadow-sm"><Bot aria-hidden="true" size={28} /></span>
          <p className="text-center text-xs font-semibold text-primary">CHÀO BẠN, MÌNH LÀ HANDIGO</p>
          <h3 className="mt-2 text-center font-headline-md text-2xl font-semibold leading-tight tracking-tight text-on-surface">
            {audience === "CUSTOMER" ? "Bạn cần giúp gì cho ngôi nhà?" : "Tôi có thể hỗ trợ gì?"}
          </h3>
          <p className="mt-2 text-center text-sm leading-6 text-on-surface-variant">
            {audience === "CUSTOMER"
              ? "Tôi có thể giúp đặt dịch vụ, gửi yêu cầu hỗ trợ, khiếu nại và tra cứu chính sách Handigo."
              : audience === "PROVIDER"
                ? "Hỏi về đơn được nhận, lịch làm việc, hồ sơ hoặc dịch vụ đăng ký."
                : "Đăng nhập để nhận hỗ trợ phù hợp với tài khoản của bạn."}
          </p>
          {audience === "CUSTOMER" && onSend && <div className="mt-6 grid gap-2">
            {[{ icon: Wrench, label: "Tìm dịch vụ phù hợp", message: "Giúp tôi chọn dịch vụ tại nhà." },
              { icon: Search, label: "Tìm đơn cũ", message: "Tôi muốn tìm đơn cũ." }].map(({ icon: Icon, label, message }) => <button
                key={label} type="button" disabled={choicesDisabled} onClick={() => void onSend(message).catch(() => undefined)}
                className="group flex min-h-14 items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-left text-sm font-medium text-on-surface transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
                <Icon size={18} aria-hidden="true" className="shrink-0 text-primary" /><span className="flex-1">{label}</span><ArrowUpRight size={16} aria-hidden="true" className="text-on-surface-variant group-hover:text-primary" />
              </button>)}
          </div>}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const container = event.currentTarget;
        if (automaticScrollTop.current !== null && Math.abs(container.scrollTop - automaticScrollTop.current) <= 1) return;
        automaticScrollTop.current = null;
        scrollMode.current = container.scrollHeight - container.scrollTop - container.clientHeight <= 48 ? "bottom" : "manual";
      }}
      aria-label="Nội dung cuộc trò chuyện"
      className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-surface-container-low/40 px-3 py-5 [scrollbar-gutter:stable] [scrollbar-width:thin] sm:px-5"
    >
      {messages.map((message) => {
        const isUser = message.sender === "user";
        const isBookingConfirmation = !isUser && message.confirmation?.tool === "create_booking";
        if (hasBookingForm && isBookingConfirmation && message.confirmation?.status === "EXPIRED") return null;
        const visibleChoiceGroups = hasBookingForm && isBookingConfirmation
          ? message.choiceGroups?.filter((group) => group.label !== "Voucher có thể sử dụng") : message.choiceGroups;
        const confirmation = !isUser && message.confirmation ? <div className={!isBookingConfirmation && message.content ? "mt-3" : ""}>
          {renderConfirmation ? renderConfirmation(message.confirmation, message.confirmation.actionId !== pendingActionId) : <AgentConfirmationCard action={message.confirmation}
            readOnly={message.confirmation.actionId !== pendingActionId}
            disabled={isReplying || confirmationsDisabled} onDecision={onDecision} />}
        </div> : null;
        const showChoices = !isUser && (message._id === latestDialogue?._id || message._id === messages.at(-1)?._id)
          && (!message.confirmation || message.confirmation.actionId === pendingActionId) && Boolean(visibleChoiceGroups?.length) && onSend;
        const canChooseBookingVouchers = bookingVoucherChoicesEnabled && isBookingConfirmation
          && message.confirmation?.actionId === pendingActionId
          && message.choiceGroups?.every((group) => ["Voucher có thể sử dụng", "Kiểm tra voucher"].includes(group.label));
        return (
          <Fragment key={message._id}>
          <div ref={isUser && message._id === latestUserMessage?._id ? latestUserRef : undefined}
            className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}>
            <div className={isUser ? "min-w-0 max-w-[88%]" : "min-w-0 w-full"}>
              <div className={`mb-2 flex items-center gap-2 px-1 text-[11px] ${isUser ? "justify-end text-on-surface-variant" : "font-semibold text-primary"}`}>
                {!isUser && <Bot size={14} aria-hidden="true" />}
                <span>{isUser ? "Bạn" : "Trợ lý Handigo"}</span>
                <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-outline-variant" />
                <time dateTime={message.createdAt} className="font-normal tabular-nums text-on-surface-variant">{formatTime(message.createdAt)}</time>
              </div>
              {isBookingConfirmation && confirmation}
              {(message.content || showChoices) && <div
              className={`${isBookingConfirmation ? "mt-3 " : ""}rounded-2xl px-4 py-3 text-sm leading-6 ${
                isUser
                  ? "rounded-tr-sm bg-primary text-on-primary shadow-sm"
                  : "rounded-tl-sm border border-outline-variant/35 bg-surface-container-lowest text-on-surface shadow-[0_2px_4px_rgba(19,27,46,0.02)]"
              }`}
            >
              {message.content && (isUser ? <p className="whitespace-pre-wrap break-words">{agentDisplayText(message.content)}</p> : <AgentMessageContent content={agentDisplayText(message.content)} />)}
              {Boolean(message.customerAttachments?.length) && <div className="mt-2 grid grid-cols-2 gap-2">
                {message.customerAttachments!.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`Mở ảnh hiện trạng ${index + 1}`} className="overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
                  <img src={url} alt={`Ảnh hiện trạng ${index + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
                </a>)}
              </div>}
              {showChoices && (
                <AgentChoiceGroups key={message._id} groups={visibleChoiceGroups!}
                  disabled={isReplying || (choicesDisabled && !canChooseBookingVouchers)} onSend={onSend!} />
              )}
              </div>}
              {!isUser && message.bookingSearch && onSend && <AgentBookingSearchResults result={message.bookingSearch}
                disabled={isReplying || choicesDisabled} paginationDisabled={message._id !== latestSearchId} onSend={onSend} />}
              {!isBookingConfirmation && confirmation}
            </div>
          </div>
          {renderAfterMessage?.(message)}
          </Fragment>
        );
      })}
      {children}
      {isReplying && (
        <div className="flex justify-start" aria-live="polite">
          <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 motion-reduce:animate-none"
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
            <span className="ml-2 text-xs text-on-surface-variant">
              {activity || "Đang trả lời"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
