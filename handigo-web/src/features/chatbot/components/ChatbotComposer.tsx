import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

const MAX_MESSAGE_LENGTH = 1000;

export function ChatbotComposer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = content.trim();
    if (!value || disabled) return;
    try {
      await onSend(value);
      setContent("");
    } catch {
      // Panel cha hiển thị lỗi API và giữ nội dung để người dùng thử lại.
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-t border-outline-variant/30 bg-surface-container-lowest/90 p-3 backdrop-blur-xl"
    >
      <div className="relative flex items-end gap-1.5 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-1.5 shadow-sm transition-colors duration-200 focus-within:border-primary/80 focus-within:shadow-[0_0_0_3px_rgba(53,37,205,0.10)]">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
          disabled={disabled}
          aria-label="Nội dung gửi cho Trợ lý Handigo"
          placeholder="Nhập câu hỏi của bạn..."
          className="max-h-28 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent pb-5 pl-3 pr-2 pt-2.5 text-sm leading-5 text-on-surface outline-none placeholder:text-on-surface-variant/65 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed"
        />
        <span className="pointer-events-none absolute bottom-2 right-14 text-[10px] font-medium leading-none text-on-surface-variant/55">
          {content.length}/{MAX_MESSAGE_LENGTH}
        </span>
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          aria-label="Gửi tin nhắn"
          className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-on-primary shadow-[0_6px_16px_rgba(53,37,205,0.2)] hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Send aria-hidden="true" size={20} />
        </button>
      </div>
    </form>
  );
}
