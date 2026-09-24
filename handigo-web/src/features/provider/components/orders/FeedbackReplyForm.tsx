import { ImagePlus, Send, X } from "lucide-react";
interface FeedbackReplyFormProps {
  content: string;
  onContentChange: (value: string) => void;
  maxContentLength: number;
  previewUrls: Array<{ file: File; url: string }>;
  onRemoveFile: (index: number) => void;
  onFilesSelected: (files: FileList | null) => void;
  maxImages: number;
  submitting: boolean;
  submitError: string;
  onSubmit: () => void;
}

export function FeedbackReplyForm({
  content,
  onContentChange,
  maxContentLength,
  previewUrls,
  onRemoveFile,
  onFilesSelected,
  maxImages,
  submitting,
  submitError,
  onSubmit,
}: FeedbackReplyFormProps) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-surface-container-lowest p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="font-bold text-on-surface">Phản hồi đánh giá</h3>
        <p className="text-xs text-on-surface-variant">Bạn chỉ có thể gửi một phản hồi chính thức.</p>
      </div>
      <textarea
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        maxLength={maxContentLength}
        rows={4}
        disabled={submitting}
        placeholder="Nhập lời cảm ơn hoặc phản hồi dành cho khách hàng..."
        className="w-full resize-none rounded-2xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
      />
      <div className="mt-1 text-right text-xs text-on-surface-variant">{content.length}/{maxContentLength}</div>

      {previewUrls.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previewUrls.map(({ file, url }, index) => (
            <div key={`${file.name}-${file.lastModified}`} className="relative aspect-square overflow-hidden rounded-xl border border-outline-variant/30">
              <img src={url} alt={`Ảnh phản hồi ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-on-surface/70 text-white"
                aria-label={`Xóa ảnh ${index + 1}`}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {submitError && <p className="mt-3 rounded-xl bg-error/10 px-3 py-2 text-sm text-error">{submitError}</p>}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-low">
          <ImagePlus aria-hidden="true" size={20} />
          Thêm ảnh ({previewUrls.length}/{maxImages})
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={submitting || previewUrls.length >= maxImages}
            onChange={(event) => { onFilesSelected(event.target.files); event.target.value = ''; }}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !content.trim()}
          className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send aria-hidden="true" size={20} />
          {submitting ? 'Đang gửi...' : 'Gửi phản hồi'}
        </button>
      </div>
    </div>
  );
}
