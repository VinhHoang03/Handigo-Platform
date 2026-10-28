import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getErrorMessage } from "@/utils/apiError";
import { chatbotApi } from "../api/chatbot.api";
import type {
  ChatbotAudience,
  ChatbotMessage,
} from "../types/chatbot.types";
import { ChatbotPanel } from "./ChatbotPanel";
import { ChatbotAvatar } from "./ChatbotAvatar";
import { agentApi } from "../api/agent.api";
import type { AgentRequest, AgentSession, AgentSend, AgentPolicyConsent } from "../types/agent.types";
import { AgentSessionHistory } from "./AgentSessionHistory";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { isAxiosError } from "axios";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";
import { clearAgentWalletResume, readAgentWalletResume, walletResumeMessage } from "../utils/agentWalletResume";

export function ChatbotWidget({
  audience,
}: {
  audience: ChatbotAudience;
}) {
  const location = useLocation();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activity, setActivity] = useState("");
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [error, setError] = useToastFeedback<string>("", "error");
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null);
  const [paymentAnchor, setPaymentAnchor] = useState<{ key: string; messageId: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const userId = useAuthStore((state) => state.user?.id ?? state.user?._id);
  const storageKey = `handigo-agent-session:${userId}`;
  const [walletResume, setWalletResume] = useState(() => audience === "CUSTOMER" ? readAgentWalletResume(userId) : null);
  const sessionId = useRef<string>(crypto.randomUUID());
  const liveOrderMessages = useRef(new Map<string, ChatbotMessage>());
  const pendingRequest = useRef<AgentRequest | null>(null);
  const sending = useRef(false);
  const usesAgent = audience === "CUSTOMER";
  const requiresNewSession = agentSession?.requiresNewSession;
  const canChat = audience === "CUSTOMER" || audience === "PROVIDER";
  const availabilityMessage =
    audience === "GUEST"
      ? "Vui lòng đăng nhập bằng tài khoản Khách hàng hoặc Nhà cung cấp để trò chuyện với trợ lý."
      : audience === "ADMIN"
        ? "Trợ lý Handigo hiện hỗ trợ tài khoản Khách hàng và Nhà cung cấp."
        : "";

  const anchorPayment = (session: AgentSession) => {
    if (!session.payment) return;
    const key = `${session.sessionId}:${session.payment.paymentId ?? session.payment.orderId}`;
    setPaymentAnchor((previous) => {
      if (previous?.key === key && session.messages.some((message) => message._id === previous.messageId)) return previous;
      const related = [...session.messages].reverse().find((message) => message.confirmation?.booking?.orderId === session.payment?.orderId
        || (["create_payment", "cancel_payment"].includes(message.confirmation?.tool ?? "") && message.confirmation?.preview.orderId === session.payment?.orderId));
      const message = related ?? [...session.messages].reverse().find((message) => message.sender === "assistant") ?? session.messages.at(-1);
      return message ? { key, messageId: message._id } : null;
    });
  };

  const applySession = (session: AgentSession) => {
    if (sessionId.current !== session.sessionId) liveOrderMessages.current.clear();
    sessionId.current = session.sessionId;
    setAgentSession(session);
    anchorPayment(session);
    setMessages((items) => {
      const merged = new Map(session.messages.map((message) => [message._id, message]));
      // Giữ thông báo vừa đến qua socket khi response của lượt chat chưa chứa sự kiện đó.
      for (const message of items) {
        if ((message._id.startsWith("order-event:") || message._id.startsWith("booking:")) && !merged.has(message._id)
          && agentSession?.sessionId === session.sessionId) merged.set(message._id, message);
      }
      for (const message of liveOrderMessages.current.values()) {
        if (!merged.has(message._id)) merged.set(message._id, message);
      }
      return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
    pendingRequest.current = session.interruptedRequest && !session.requiresReconciliation
      ? { ...session.interruptedRequest, sessionId: session.sessionId } : null;
    if (pendingRequest.current) setError("Lượt trước chưa hoàn tất. Chọn Thử lại để tiếp tục an toàn.");
    try { sessionStorage.setItem(storageKey, session.sessionId); } catch { /* Vẫn dùng được chat khi trình duyệt chặn lưu trữ. */ }
  };

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError("");
      if (usesAgent) {
        let selectedId: string | null = !hasLoaded ? walletResume?.sessionId ?? null : null;
        try { selectedId ??= sessionStorage.getItem(storageKey); } catch { /* Tải cuộc trò chuyện gần nhất nếu không có lưu trữ. */ }
        const session = selectedId ? await agentApi.get(selectedId).catch((error: unknown) => {
          if (isAxiosError(error) && error.response?.status === 404) return agentApi.latest();
          throw error;
        }) : await agentApi.latest();
        if (session) {
          applySession(session);
        }
      } else {
        const history = await chatbotApi.history();
        setMessages(history.items);
      }
      setHasLoaded(true);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Không thể tải lịch sử trò chuyện. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const restoreWalletConversation = useEffectEvent(() => {
    setIsOpen(true);
    void loadHistory();
  });
  useEffect(() => {
    if (!usesAgent || !walletResume?.sessionId) return;
    const timer = window.setTimeout(() => restoreWalletConversation(), 0);
    return () => window.clearTimeout(timer);
  }, [usesAgent, walletResume?.sessionId]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  useEffect(() => {
    if (!usesAgent || !userId) return;
    let disposed = false;
    const { socket, dispose } = createAuthenticatedSocket();
    const receive = (update: { sessionId: string; message: ChatbotMessage }) => {
      if (update.sessionId !== sessionId.current) return;
      liveOrderMessages.current.set(update.message._id, update.message);
      setMessages((items) => [...items.filter((item) => item._id !== update.message._id), update.message]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      void refresh();
    };
    const refresh = async () => {
      // Nạp lại các mốc bị lỡ khi mất socket; không thay thế lượt khách đang gửi.
      if (sending.current) return;
      const id = sessionId.current;
      try {
        const session = await agentApi.get(id);
        if (disposed || id !== sessionId.current || sending.current) return;
        setMessages((items) => {
          const stored = new Map(session.messages.map((message) => [message._id, message]));
          for (const message of items) if (!stored.has(message._id)) stored.set(message._id, message);
          return [...stored.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
        setAgentSession(session);
        anchorPayment(session);
      } catch { /* Lịch sử vẫn có thể được tải lại khi mở chat hoặc chọn Thử lại. */ }
    };
    socket.on("agent:order:message", receive);
    socket.on("connect", refresh);
    return () => {
      disposed = true;
      socket.off("agent:order:message", receive);
      socket.off("connect", refresh);
      dispose();
    };
  }, [usesAgent, userId]);

  const sendMessage: AgentSend = async (content, customerAttachments, bookingAction) => {
    if (sending.current || isLoading) return;
    sending.current = true;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    if (content && (!usesAgent || !pendingRequest.current)) {
      setMessages((items) => [...items, {
        _id: optimisticId, sender: "user", content, customerAttachments, createdAt: new Date().toISOString(),
      }]);
    }
    try {
      setIsReplying(true);
      setActivity("");
      setError("");
      if (usesAgent) {
        pendingRequest.current ??= { sessionId: sessionId.current, requestId: crypto.randomUUID(), message: content,
          ...(bookingAction ? { bookingAction } : {}),
          ...(customerAttachments !== undefined ? { customerAttachments } : {}) };
        const session = await agentApi.send(pendingRequest.current);
        applySession(session);
        return;
      }
      const reply = await chatbotApi.send(content, location.pathname);
      setMessages((items) => [
        ...items.filter((item) => item._id !== optimisticId),
        reply.userMessage,
        reply.assistantMessage,
      ]);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Trợ lý Handigo chưa thể trả lời. Vui lòng thử lại.",
        ),
      );
      if (!usesAgent) {
        setMessages((items) => items.filter((item) => item._id !== optimisticId));
      }
      throw requestError;
    } finally {
      sending.current = false;
      setIsReplying(false);
    }
  };

  useEffect(() => {
    if (!usesAgent || !isReplying || !isOpen) return;
    const controller = new AbortController();
    const request = pendingRequest.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!request || controller.signal.aborted) return;
      try {
        const progress = await agentApi.progress(request.sessionId, controller.signal);
        if (!controller.signal.aborted && progress.requestId === request.requestId) {
          setActivity(progress.activity?.requestId === request.requestId ? progress.activity.message : "Đang xử lý yêu cầu");
        }
      } catch { /* Tiến trình chỉ để hiển thị; request chính vẫn tiếp tục khi polling lỗi. */ }
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 1500);
    };
    timer = setTimeout(() => void poll(), 500);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [usesAgent, isReplying, isOpen]);

  const decide = async (decision: "CONFIRM" | "REJECT", policyConsent?: AgentPolicyConsent) => {
    if (sending.current || !agentSession?.pendingConfirmation) return;
    pendingRequest.current ??= { sessionId: sessionId.current, requestId: crypto.randomUUID(), confirmation: {
      actionId: agentSession.pendingConfirmation.actionId, decision, ...(policyConsent ? { policyConsent } : {}),
    } };
    try { await sendMessage(""); } catch { /* Lỗi đã hiển thị trong panel. */ }
  };

  const retry = async () => {
    if (usesAgent && pendingRequest.current) {
      try { await sendMessage(""); } catch { /* Giữ requestId để thử lại an toàn. */ }
    } else await loadHistory();
  };

  const resetSession = async () => {
    if (sending.current || isLoading || agentSession?.pendingConfirmation || agentSession?.requiresReconciliation) return;
    sending.current = true;
    setIsLoading(true);
    setError("");
    try {
      const session = await agentApi.reset(sessionId.current);
      applySession(session);
      setShowHistory(false);
      setHasLoaded(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Chưa tạo được phiên mới. Chọn Thử lại để tải trạng thái đã lưu."));
    } finally {
      sending.current = false;
      setIsLoading(false);
    }
  };

  const selectSession = async (id: string) => {
    if (sending.current || isLoading || pendingRequest.current) return;
    setIsLoading(true);
    setError("");
    try {
      applySession(await agentApi.get(id));
      setShowHistory(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Chưa mở được cuộc trò chuyện. Hãy chọn lại để thử."));
    } finally { setIsLoading(false); }
  };

  const openWidget = () => {
    setIsOpen(true);
    if (canChat && !hasLoaded && !isLoading) void loadHistory();
  };

  const deleteSession = async (id: string) => {
    if (sending.current || isLoading) throw new Error("Vui lòng chờ lượt xử lý hoàn tất.");
    sending.current = true;
    setIsLoading(true);
    try {
      await agentApi.delete(id);
      addToast("Đã xóa cuộc trò chuyện.", "success");
      if (sessionId.current === id) {
        liveOrderMessages.current.clear();
        sessionId.current = crypto.randomUUID();
        pendingRequest.current = null;
        setAgentSession(null);
        setMessages([]);
        setActivity("");
        setError("");
        try { sessionStorage.removeItem(storageKey); } catch { /* Chat vẫn hoạt động khi trình duyệt chặn lưu trữ. */ }
      }
    } finally {
      sending.current = false;
      setIsLoading(false);
    }
  };

  const dismissWalletResume = () => {
    if (userId) clearAgentWalletResume(userId);
    setWalletResume(null);
  };
  const resumeWalletBooking = async () => {
    if (!walletResume || sending.current || isLoading || pendingRequest.current) return;
    await sendMessage(walletResumeMessage(walletResume));
    dismissWalletResume();
  };
  const uploadAttachment = async (file: File) => {
    if (sending.current || pendingRequest.current) throw new Error("Vui lòng hoàn tất lượt xử lý trước khi tải ảnh.");
    sending.current = true;
    setIsUploading(true);
    try { return (await agentApi.uploadAttachment(sessionId.current, file)).url; }
    finally { sending.current = false; setIsUploading(false); }
  };

  return (
    <>
      {isOpen && (
        <ChatbotPanel
          audience={audience}
          messages={messages}
          isLoading={isLoading}
          isReplying={isReplying || isUploading}
          activity={isUploading ? "Đang tải ảnh hiện trạng" : activity}
          error={error}
          availabilityMessage={requiresNewSession ? "Cuộc trò chuyện đã đạt giới hạn lưu trữ. Bạn vẫn có thể xem lại trong lịch sử và bắt đầu cuộc trò chuyện mới." : availabilityMessage}
          onToggleHistory={usesAgent ? () => setShowHistory((value) => !value) : undefined}
          history={showHistory ? <AgentSessionHistory currentId={agentSession?.sessionId ?? ""}
            disabled={isLoading || isReplying} onSelect={(id) => void selectSession(id)} onDelete={deleteSession} /> : undefined}
          onContinue={usesAgent && (agentSession?.state === "FAILED" || agentSession?.retryableStep) && !requiresNewSession && !error
            && ((!agentSession.requiresReconciliation && !agentSession.interruptedRequest)
              || agentSession.requiresReconciliation || agentSession.messages.some((message) => message.confirmation?.tool === "create_booking"
                && ["UNKNOWN", "EXECUTING"].includes(message.confirmation.status ?? "")))
            ? () => void sendMessage("Tiếp tục yêu cầu.").catch(() => undefined) : undefined}
          onClose={() => setIsOpen(false)}
          onRetry={() => void retry()}
          onSend={sendMessage}
          onUploadAttachment={usesAgent && !agentSession?.requiresReconciliation ? uploadAttachment : undefined}
          agentSession={usesAgent ? agentSession : undefined}
          userId={userId}
          walletResume={walletResume}
          onResumeWallet={resumeWalletBooking}
          onDismissWallet={dismissWalletResume}
          pendingConfirmation={agentSession?.pendingConfirmation}
          payment={agentSession?.payment}
          paymentMessageId={paymentAnchor?.key === `${agentSession?.sessionId}:${agentSession?.payment?.paymentId ?? agentSession?.payment?.orderId}`
            ? paymentAnchor.messageId : undefined}
          onCheckPayment={(orderId) => {
            if (sending.current) return;
            if (agentSession?.requiresReconciliation) pendingRequest.current = null;
            pendingRequest.current ??= { sessionId: sessionId.current, requestId: crypto.randomUUID(), paymentStatus: { orderId } };
            void sendMessage("").catch(() => undefined);
          }}
          onChangePaymentMethod={(orderId) => {
            const payment = agentSession?.payment;
            void sendMessage(payment?.orderId === orderId && ["unpaid", "failed"].includes(payment.status)
              ? `Tôi muốn thanh toán lại đơn ${orderId}. Cho tôi chọn phương thức thanh toán phù hợp.`
              : `Đổi phương thức thanh toán cho đơn ${orderId}.`).catch(() => undefined);
          }}
          onCancelPayment={(orderId, paymentId) => {
            void sendMessage(`Hủy QR thanh toán đơn ${orderId}, giao dịch ${paymentId}.`).catch(() => undefined);
          }}
          onDecision={(decision, policyConsent) => void decide(decision, policyConsent)}
          taskBlocked={agentSession?.requiresReconciliation || (usesAgent && Boolean(error))}
          onNewSession={usesAgent ? () => void resetSession() : undefined}
        />
      )}
      {!isOpen && (
        <button
          type="button"
          onClick={openWidget}
          aria-label="Mở Trợ lý Handigo"
          aria-expanded={false}
          className="fixed bottom-20 right-4 z-[131] h-14 w-14 overflow-hidden rounded-2xl border-2 border-white/90 bg-primary p-0 shadow-[0_8px_24px_rgba(19,27,46,0.22)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:scale-100 lg:bottom-6 lg:right-6"
        >
          <ChatbotAvatar className="block h-full w-full rounded-[inherit]" />
        </button>
      )}
    </>
  );
}
