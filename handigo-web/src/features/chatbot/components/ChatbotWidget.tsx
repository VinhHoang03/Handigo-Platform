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
import { AgentSessionHistory } from "./AgentSessionHistory";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { isAxiosError } from "axios";

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
  const [activity, setActivity] = useState("");
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [error, setError] = useState("");
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const userId = useAuthStore((state) => state.user?.id ?? state.user?._id);
  const storageKey = `handigo-agent-session:${userId}`;
  const sessionId = useRef<string>(crypto.randomUUID());
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

  const applySession = (session: AgentSession) => {
    sessionId.current = session.sessionId;
    setAgentSession(session);
    setMessages(session.messages);
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
        let selectedId: string | null = null;
        try { selectedId = sessionStorage.getItem(storageKey); } catch { /* Tải cuộc trò chuyện gần nhất nếu không có lưu trữ. */ }
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

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const sendMessage = async (content: string) => {
    if (sending.current || isLoading) return;
    sending.current = true;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    if (content && (!usesAgent || !pendingRequest.current)) {
      setMessages((items) => [...items, {
        _id: optimisticId, sender: "user", content, createdAt: new Date().toISOString(),
      }]);
    }
    try {
      setIsReplying(true);
      setActivity("");
      setError("");
      if (usesAgent) {
        pendingRequest.current ??= { sessionId: sessionId.current, requestId: crypto.randomUUID(), message: content };
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
        throw requestError;
      }
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
      applySession(session);
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
      if (sessionId.current === id) {
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

  return (
    <>
      {isOpen && (
        <ChatbotPanel
          audience={audience}
          messages={messages}
          isLoading={isLoading}
          isReplying={isReplying}
          activity={activity}
          error={error}
          availabilityMessage={requiresNewSession ? "Cuộc trò chuyện đã đạt giới hạn lưu trữ. Bạn vẫn có thể xem lại trong lịch sử và bắt đầu cuộc trò chuyện mới." : availabilityMessage}
          onToggleHistory={usesAgent ? () => setShowHistory((value) => !value) : undefined}
          history={showHistory ? <AgentSessionHistory currentId={agentSession?.sessionId ?? ""}
            disabled={isLoading || isReplying} onSelect={(id) => void selectSession(id)} onDelete={deleteSession} /> : undefined}
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
