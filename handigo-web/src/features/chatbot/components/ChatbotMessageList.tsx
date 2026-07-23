import { useEffect, useRef } from "react";
import type {
  ChatbotAudience,
  ChatbotMessage,
} from "../types/chatbot.types";
import { Bot } from "lucide-react";

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function ChatbotMessageList({
  messages,
  isReplying,
  audience,
}: {
  messages: ChatbotMessage[];
  isReplying: boolean;
  audience: ChatbotAudience;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isReplying, messages]);

  if (!messages.length && !isReplying) {
    return (
      <div className="grid flex-1 place-items-center px-7 py-10 text-center">
        <div>
          <Bot aria-hidden="true" size={30} className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary" />
          <h3 className="mt-4 font-headline-md text-lg text-on-surface">
            Tôi có thể hỗ trợ gì?
          </h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {audience === "CUSTOMER"
              ? "Hỏi về dịch vụ, cách đặt đơn hoặc trạng thái đơn gần đây."
              : audience === "PROVIDER"
                ? "Hỏi về đơn được nhận, lịch làm việc, hồ sơ hoặc dịch vụ đăng ký."
                : "Đăng nhập để nhận hỗ trợ phù hợp với tài khoản của bạn."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.08),transparent_38%)] px-4 py-5">
      {messages.map((message) => {
        const isUser = message.sender === "user";
        return (
          <div
            key={message._id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                isUser
                  ? "rounded-br-md bg-primary text-on-primary"
                  : "rounded-bl-md border border-outline-variant/30 bg-surface-container-lowest text-on-surface"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <time
                className={`mt-1 block text-right text-[10px] ${
                  isUser ? "text-on-primary/70" : "text-on-surface-variant"
                }`}
              >
                {formatTime(message.createdAt)}
              </time>
            </div>
          </div>
        );
      })}
      {isReplying && (
        <div className="flex justify-start" aria-live="polite">
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-sm">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-2 w-2 animate-bounce rounded-full bg-primary/70"
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
            <span className="ml-2 text-xs text-on-surface-variant">
              Đang trả lời
            </span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
