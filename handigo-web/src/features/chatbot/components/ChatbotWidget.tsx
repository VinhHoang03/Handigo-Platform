import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getErrorMessage } from "@/utils/apiError";
import { chatbotApi } from "../api/chatbot.api";
import type {
  ChatbotAudience,
  ChatbotMessage,
} from "../types/chatbot.types";
import { ChatbotPanel } from "./ChatbotPanel";
import { ChatbotAvatar } from "./ChatbotAvatar";

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
      const history = await chatbotApi.history();
      setMessages(history.items);
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
    try {
      setIsReplying(true);
      setError("");
      const reply = await chatbotApi.send(content, location.pathname);
      setMessages((items) => [
        ...items,
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
      throw requestError;
    } finally {
      setIsReplying(false);
    }
  };

  const openWidget = () => {
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
          availabilityMessage={availabilityMessage}
          onClose={() => setIsOpen(false)}
          onRetry={() => void loadHistory()}
          onSend={sendMessage}
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
