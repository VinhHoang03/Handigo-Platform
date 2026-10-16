import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ImagePlus, LoaderCircle, Mic, RotateCcw, Send, Square, X } from "lucide-react";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { getErrorMessage } from "@/utils/apiError";

const MAX_MESSAGE_LENGTH = 1000;

export function ChatbotComposer({
  disabled,
  onSend,
  onNewSession,
  resetDisabled = false,
  voiceEnabled = false,
  onUploadAttachment,
  attachmentUrls = [],
  onAttachmentChange,
}: {
  disabled: boolean;
  onSend: (content: string, customerAttachments?: string[]) => Promise<void>;
  onUploadAttachment?: (file: File) => Promise<string>;
  attachmentUrls?: string[];
  onAttachmentChange?: (dirty: boolean) => void;
  onNewSession?: () => void;
  resetDisabled?: boolean;
  voiceEnabled?: boolean;
}) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<string[] | undefined>();
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = attachments ?? attachmentUrls;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceInput(disabled || !voiceEnabled, MAX_MESSAGE_LENGTH, setContent);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  }, [content]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = content.trim() || (attachments !== undefined ? "Cập nhật ảnh hiện trạng cho bản nháp đặt dịch vụ này." : "");
    if (!value || disabled || uploading || voice.listening) return;
    voice.cancel();
    setContent("");
    try {
      await onSend(value, attachments);
      setAttachments(undefined);
      onAttachmentChange?.(false);
    } catch {
      setContent(value);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!onUploadAttachment || disabled || uploading || voice.listening) return;
    setAttachmentError("");
    if (files.length + selected.length > 4) { setAttachmentError("Chỉ được đính kèm tối đa 4 ảnh."); return; }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setAttachmentError("Chọn ảnh JPEG, PNG, WebP, GIF hoặc AVIF, tối đa 5 MB mỗi ảnh."); return;
    }
    setUploading(true);
    const next = [...selected];
    try {
      for (const file of files) {
        next.push(await onUploadAttachment(file));
        setAttachments([...next]);
        onAttachmentChange?.(true);
      }
    } catch (error) { setAttachmentError(getErrorMessage(error, "Chưa tải được ảnh. Bạn có thể thử lại.")); }
    finally { setUploading(false); }
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
      className="shrink-0 border-t border-outline-variant/30 bg-surface-container-lowest p-3 sm:px-4"
    >
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low/50 p-2 transition-colors duration-200 focus-within:border-primary/60 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/10">
        {onUploadAttachment && selected.length > 0 && <div className="flex gap-2 overflow-x-auto px-2 pt-2" aria-label="Ảnh hiện trạng đính kèm">
          {selected.map((url, index) => <div key={url} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-outline-variant/50">
            <img src={url} alt={`Ảnh hiện trạng ${index + 1}`} className="h-full w-full object-cover" />
            <button type="button" disabled={disabled || uploading} onClick={() => { setAttachments(selected.filter((item) => item !== url)); onAttachmentChange?.(true); }}
              aria-label={`Bỏ ảnh hiện trạng ${index + 1}`} className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-bl-xl bg-surface-container-lowest/90 text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><X size={16} aria-hidden="true" /></button>
          </div>)}
        </div>}
        <textarea
          ref={inputRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
          disabled={disabled}
          readOnly={voice.listening}
          aria-label="Nội dung gửi cho Trợ lý Handigo"
          name="message"
          autoComplete="off"
          placeholder={disabled ? "Vui lòng chờ để tiếp tục…" : "Nhắn yêu cầu của bạn…"}
          className="block max-h-32 min-h-11 w-full resize-none border-0 bg-transparent px-2 py-2.5 text-base leading-6 text-on-surface outline-none placeholder:text-on-surface-variant focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed sm:text-sm"
        />
        <div className="mt-1 flex items-center gap-1">
        {onNewSession && (
          <button
            type="button"
            onClick={() => { voice.cancel(); setContent(""); setAttachments(undefined); setAttachmentError(""); onNewSession(); }}
            disabled={resetDisabled || uploading}
            aria-label="Bắt đầu tác vụ mới"
            title="Bắt đầu tác vụ mới"
            className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw aria-hidden="true" size={15} /><span>Tác vụ mới</span>
          </button>
        )}
        <span className="flex-1" />
        {content.length > MAX_MESSAGE_LENGTH - 100 && <span className="text-[11px] tabular-nums text-on-surface-variant">{content.length}/{MAX_MESSAGE_LENGTH}</span>}
        {onUploadAttachment && <>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label="Chọn ảnh hiện trạng" className="hidden"
            onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void uploadFiles(files); }} />
          <button type="button" disabled={disabled || uploading || voice.listening || selected.length >= 4} onClick={() => fileRef.current?.click()}
            aria-label="Đính kèm ảnh hiện trạng" title="Đính kèm tối đa 4 ảnh, 5 MB mỗi ảnh"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-on-surface-variant hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">
            {uploading ? <LoaderCircle size={20} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <ImagePlus size={20} aria-hidden="true" />}
          </button>
        </>}
        {voiceEnabled && (
          <button
            type="button"
            onClick={() => voice.toggle(content)}
            disabled={disabled || !voice.supported}
            aria-label={voice.listening ? "Dừng nhập giọng nói" : "Nhập bằng giọng nói"}
            aria-pressed={voice.listening}
            title={voice.supported ? voice.listening ? "Dừng nhập giọng nói" : "Nhập bằng giọng nói" : "Trình duyệt chưa hỗ trợ nhập giọng nói"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 ${voice.listening ? "bg-error-container text-on-error-container" : "text-on-surface-variant hover:bg-primary/10 hover:text-primary"}`}
          >
            {voice.listening ? <Square aria-hidden="true" size={18} /> : <Mic aria-hidden="true" size={20} />}
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || uploading || voice.listening || (!content.trim() && attachments === undefined)}
          aria-label="Gửi tin nhắn"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
        >
          <Send aria-hidden="true" size={20} />
        </button>
        </div>
      </div>
      {attachmentError && <p role="alert" className="mt-2 px-1 text-xs text-error">{attachmentError}</p>}
      {onUploadAttachment && (selected.length > 0 || attachments !== undefined) && <p className="mt-2 px-1 text-xs text-on-surface-variant">{selected.length}/4 ảnh hiện trạng. {attachments !== undefined ? "Nhấn Gửi để cập nhật ảnh trước khi xác nhận." : "Ảnh sẽ được gửi kèm đơn sau xác nhận."} Agent chưa phân tích nội dung ảnh.</p>}
      {voiceEnabled && (voice.error || voice.listening || !voice.supported) && (
        <p role="status" className="mt-2 px-1 text-xs leading-5 text-on-surface-variant">
          {voice.error || (voice.listening ? "Đang nghe tiếng Việt… Nhấn dừng, kiểm tra nội dung rồi gửi." : "Trình duyệt chưa hỗ trợ giọng nói. Bạn vẫn có thể nhập bằng bàn phím.")}
        </p>
      )}
    </form>
  );
}
