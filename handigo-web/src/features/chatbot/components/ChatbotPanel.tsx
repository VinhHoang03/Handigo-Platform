import type { ChatbotAudience, ChatbotMessage } from "../types/chatbot.types";
import { ChatbotComposer } from "./ChatbotComposer";
import { ChatbotMessageList } from "./ChatbotMessageList";
import { ChatbotAvatar } from "./ChatbotAvatar";

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
  error,
  availabilityMessage,
  onClose,
  onRetry,
  onSend,
}: {
  audience: ChatbotAudience;
  messages: ChatbotMessage[];
  isLoading: boolean;
  isReplying: boolean;
  error: string;
  availabilityMessage: string;
  onClose: () => void;
  onRetry: () => void;
  onSend: (content: string) => Promise<void>;
}) {
  return (
    <aside
      aria-label="Trợ lý Handigo"
      className="fixed inset-x-3 bottom-3 z-[130] flex h-[min(620px,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface shadow-[0_20px_60px_rgba(19,27,46,0.22)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(590px,calc(100dvh-3rem))] sm:w-[390px]"
    >
      <header className="relative overflow-hidden bg-primary px-4 py-4 text-on-primary">
        <span className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ChatbotAvatar className="block h-11 w-11 shrink-0 rounded-2xl border-2 border-white/40" />
            <div className="min-w-0">
              <h2 className="truncate font-headline-md text-lg font-semibold">
                Trợ lý Handigo
              </h2>
              <p className="flex items-center gap-1.5 text-xs text-on-primary/80">
                <span className="h-2 w-2 rounded-full bg-secondary-fixed" />
                {getAudienceLabel(audience)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trợ lý"
              className="rounded-full p-2 hover:bg-white/15"
            >
              <span className="material-symbols-outlined block text-xl">
                close
              </span>
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="grid flex-1 place-items-center text-sm text-on-surface-variant">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary">
              progress_activity
            </span>
            <p className="mt-2">Đang tải cuộc trò chuyện...</p>
          </div>
        </div>
      ) : (
        <ChatbotMessageList
          messages={messages}
          isReplying={isReplying}
          audience={audience}
        />
      )}

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
      <ChatbotComposer
        disabled={isLoading || isReplying || Boolean(availabilityMessage)}
        onSend={onSend}
      />
    </aside>
  );
}
