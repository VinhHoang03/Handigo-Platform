import { useEffect, useRef, useState } from "react";
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
import type { AgentRequest, AgentSession } from "../types/agent.types";

export function ChatbotWidget({
  audience,
}: {
  audience: ChatbotAudience;
}) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [error, setError] = useState("");
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const sessionId = useRef<string>(crypto.randomUUID());
  const pendingRequest = useRef<AgentRequest | null>(null);
  const sending = useRef(false);
  const usesAgent = audience === "CUSTOMER";
  const sessionExpired = Boolean(agentSession?.expiresAt && now >= Date.parse(agentSession.expiresAt));
  const requiresNewSession = sessionExpired || agentSession?.requiresNewSession;
  const canChat = audience === "CUSTOMER" || audience === "PROVIDER";
  const availabilityMessage =
    audience === "GUEST"
      ? "Vui lòng đăng nhập bằng tài khoản Khách hàng hoặc Nhà cung cấp để trò chuyện với trợ lý."
      : audience === "ADMIN"
        ? "Trợ lý Handigo hiện hỗ trợ tài khoản Khách hàng và Nhà cung cấp."
        : "";

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError("");
      if (usesAgent) {
        const session = await agentApi.latest();
        setNow(Date.now());
        if (session) {
          sessionId.current = session.sessionId;
          setAgentSession(session);
          setMessages(session.messages);
          if (session.interruptedRequest && !session.requiresReconciliation) {
            pendingRequest.current = { ...session.interruptedRequest, sessionId: session.sessionId };
            setError("Lượt trước chưa hoàn tất. Chọn Thử lại để tiếp tục an toàn.");
          }
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

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const sendMessage = async (content: string) => {
    if (sending.current) return;
    sending.current = true;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    if (content && (!usesAgent || !pendingRequest.current)) {
      setMessages((items) => [...items, {
        _id: optimisticId, sender: "user", content, createdAt: new Date().toISOString(),
      }]);
    }
    try {
      setIsReplying(true);
      setError("");
      if (usesAgent) {
        pendingRequest.current ??= { sessionId: sessionId.current, requestId: crypto.randomUUID(), message: content };
        const session = await agentApi.send(pendingRequest.current);
        setNow(Date.now());
        pendingRequest.current = null;
        setAgentSession(session);
        setMessages(session.messages);
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
        throw requestError;
      }
    } finally {
      sending.current = false;
      setIsReplying(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !agentSession?.expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, agentSession?.expiresAt]);

  const decide = async (decision: "CONFIRM" | "REJECT") => {
    if (sending.current || !agentSession?.pendingConfirmation) return;
    pendingRequest.current ??= { sessionId: sessionId.current, requestId: crypto.randomUUID(), confirmation: {
      actionId: agentSession.pendingConfirmation.actionId, decision,
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
      sessionId.current = session.sessionId;
      pendingRequest.current = null;
      setAgentSession(session);
      setMessages(session.messages);
      setNow(Date.now());
      setHasLoaded(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Chưa tạo được phiên mới. Chọn Thử lại để tải trạng thái đã lưu."));
    } finally {
      sending.current = false;
      setIsLoading(false);
    }
  };

  const openWidget = () => {
    setNow(Date.now());
    setIsOpen(true);
    if (canChat && !hasLoaded && !isLoading) void loadHistory();
  };

  return (
    <>
      {isOpen && (
        <ChatbotPanel
          audience={audience}
          messages={messages}
          isLoading={isLoading}
          isReplying={isReplying}
          error={error}
          availabilityMessage={sessionExpired
            ? "Phiên đã hết hạn sau 30 phút không hoạt động. Chọn Bắt đầu tác vụ mới rồi gửi yêu cầu. Đơn đã tạo vẫn được giữ nguyên."
            : requiresNewSession ? "Phiên đã đầy. Chọn Bắt đầu tác vụ mới để tiếp tục." : availabilityMessage}
          onContinue={usesAgent && agentSession?.state === "FAILED" && !requiresNewSession
            && !agentSession.requiresReconciliation && !agentSession.interruptedRequest && !error
            ? () => void sendMessage("Tiếp tục yêu cầu đang thực hiện từ kết quả đã lưu; không thực hiện lại thao tác đã thành công.") : undefined}
          onClose={() => setIsOpen(false)}
          onRetry={() => void retry()}
          onSend={sendMessage}
          pendingConfirmation={agentSession?.pendingConfirmation}
          payment={agentSession?.payment}
          onCheckPayment={(orderId) => {
            if (sending.current) return;
            if (agentSession?.requiresReconciliation) pendingRequest.current = null;
            pendingRequest.current ??= { sessionId: sessionId.current, requestId: crypto.randomUUID(), paymentStatus: { orderId } };
            void sendMessage("");
          }}
          onDecision={(decision) => void decide(decision)}
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
          className="fixed bottom-20 right-4 z-[131] h-14 w-14 overflow-hidden rounded-2xl border-2 border-white/90 bg-primary p-0 shadow-[0_12px_30px_rgba(53,37,205,0.35)] hover:scale-105 lg:bottom-6 lg:right-6"
        >
          <ChatbotAvatar className="block h-full w-full rounded-[inherit]" />
        </button>
      )}
    </>
  );
}
