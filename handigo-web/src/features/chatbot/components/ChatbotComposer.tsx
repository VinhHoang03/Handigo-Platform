import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Mic, RotateCcw, Send, Square } from "lucide-react";
import { useVoiceInput } from "../hooks/useVoiceInput";

const MAX_MESSAGE_LENGTH = 1000;

export function ChatbotComposer({
  disabled,
  onSend,
  onNewSession,
  resetDisabled = false,
  voiceEnabled = false,
}: {
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
  onNewSession?: () => void;
  resetDisabled?: boolean;
  voiceEnabled?: boolean;
}) {
  const [content, setContent] = useState("");
  const voice = useVoiceInput(disabled || !voiceEnabled, MAX_MESSAGE_LENGTH, setContent);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = content.trim();
    if (!value || disabled || voice.listening) return;
    voice.cancel();
    setContent("");
    try {
      await onSend(value);
    } catch {
      setContent(value);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="shrink-0 border-t border-outline-variant/30 bg-surface-container-lowest/90 p-3 backdrop-blur-xl"
    >
      <div className="relative flex items-end gap-1.5 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-1.5 shadow-sm transition-colors duration-200 focus-within:border-primary/80 focus-within:shadow-[0_0_0_3px_rgba(53,37,205,0.10)]">
        <div className="relative min-w-0 flex-1">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
          disabled={disabled}
          readOnly={voice.listening}
          aria-label="Nội dung gửi cho Trợ lý Handigo"
          placeholder="Nhập câu hỏi của bạn..."
          className="block max-h-28 min-h-11 w-full resize-none border-0 bg-transparent py-2.5 pl-3 pr-2 text-sm leading-5 text-on-surface outline-none placeholder:text-on-surface-variant/65 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed"
        />
        </div>
        {voiceEnabled && (
          <button
            type="button"
            onClick={() => voice.toggle(content)}
            disabled={disabled || !voice.supported}
            aria-label={voice.listening ? "Dừng nhập giọng nói" : "Nhập bằng giọng nói"}
            aria-pressed={voice.listening}
            title={voice.supported ? voice.listening ? "Dừng nhập giọng nói" : "Nhập bằng giọng nói" : "Trình duyệt chưa hỗ trợ nhập giọng nói"}
            className={`mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 ${voice.listening ? "bg-error-container text-on-error-container" : "text-on-surface-variant hover:bg-primary/10 hover:text-primary"}`}
          >
            {voice.listening ? <Square aria-hidden="true" size={18} /> : <Mic aria-hidden="true" size={20} />}
          </button>
        )}
        {onNewSession && (
          <button
            type="button"
            onClick={() => { voice.cancel(); setContent(""); onNewSession(); }}
            disabled={resetDisabled}
            aria-label="Bắt đầu tác vụ mới"
            title="Bắt đầu tác vụ mới"
            className="mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-on-surface-variant hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw aria-hidden="true" size={20} />
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || voice.listening || !content.trim()}
          aria-label="Gửi tin nhắn"
          className="mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary shadow-[0_6px_16px_rgba(53,37,205,0.2)] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Send aria-hidden="true" size={20} />
        </button>
      </div>
      {voiceEnabled && (voice.error || voice.listening || !voice.supported) && (
        <p role="status" className="mt-2 px-1 text-xs leading-5 text-on-surface-variant">
          {voice.error || (voice.listening ? "Đang nghe tiếng Việt… Nhấn dừng, kiểm tra nội dung rồi gửi." : "Trình duyệt chưa hỗ trợ giọng nói. Bạn vẫn có thể nhập bằng bàn phím.")}
        </p>
      )}
    </form>
  );
}
