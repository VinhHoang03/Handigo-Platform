import type { FormEvent, ReactNode } from "react";
import { Modal } from "@/components/common/Modal";
import type { NewsArticlePayload, NewsArticleRecord } from "@/features/content/api/news.api";
import { NewsContentBlocksEditor } from "./NewsContentBlocksEditor";
import { Upload } from "lucide-react";

interface NewsFormModalProps {
  open: boolean;
  editing: NewsArticleRecord | null;
  form: NewsArticlePayload;
  onFormChange: (form: NewsArticlePayload) => void;
  isSaving: boolean;
  isUploading: boolean;
  error: string;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  onUploadCover: (file: File) => void;
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-bold text-on-surface">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

export function NewsFormModal({
  open,
  editing,
  form,
  onFormChange,
  isSaving,
  isUploading,
  error,
  onSubmit,
  onClose,
  onUploadCover,
}: NewsFormModalProps) {
  return (
    <Modal open={open} title={editing ? "Chỉnh sửa bài viết" : "Đăng bài mới"} size="xl" onClose={onClose} closeOnOverlayClick={!isSaving}>
      <form className="space-y-6" onSubmit={onSubmit}>
        {error && <p role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-error">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tiêu đề bài viết" className="md:col-span-2">
            <input required minLength={5} maxLength={200} value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Danh mục">
            <input required maxLength={80} value={form.category} onChange={(event) => onFormChange({ ...form, category: event.target.value })} className={inputClass} list="news-categories" />
            <datalist id="news-categories">
              <option value="Thông báo hệ thống" /><option value="Mẹo sửa chữa" /><option value="Khuyến mãi" /><option value="Tin tức cộng đồng" />
            </datalist>
          </Field>
          <Field label="Tên tác giả">
            <input required maxLength={120} value={form.authorName} onChange={(event) => onFormChange({ ...form, authorName: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Mô tả ngắn" className="md:col-span-2">
            <textarea required minLength={10} maxLength={500} rows={3} value={form.excerpt} onChange={(event) => onFormChange({ ...form, excerpt: event.target.value })} className={`resize-y py-2.5 ${inputClass}`} />
          </Field>
        </div>

        <section className="rounded-2xl border border-outline-variant/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-on-surface">Ảnh bìa</h3>
              <p className="text-sm text-on-surface-variant">Ảnh ngang, rõ nét và phù hợp với nội dung bài.</p>
            </div>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-primary px-4 text-sm font-bold text-primary">
              <Upload aria-hidden="true" size={19} className="block leading-none" />
              {isUploading ? "Đang tải…" : "Tải ảnh"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                disabled={isUploading}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadCover(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {form.coverImage && <img src={form.coverImage} alt="Xem trước ảnh bìa" width="1200" height="630" className="mt-4 h-52 w-full rounded-xl object-cover" />}
          <input required type="url" maxLength={1000} value={form.coverImage} onChange={(event) => onFormChange({ ...form, coverImage: event.target.value })} placeholder="Hoặc nhập URL ảnh bìa" className={`mt-4 ${inputClass}`} />
        </section>

        <NewsContentBlocksEditor content={form.content} onChange={(content) => onFormChange({ ...form, content })} />

        <div className="grid gap-4 rounded-2xl bg-surface-container-low p-4 sm:grid-cols-2 sm:items-center">
          <Field label="Trạng thái">
            <select value={form.status} onChange={(event) => onFormChange({ ...form, status: event.target.value as NewsArticlePayload["status"] })} className={inputClass}>
              <option value="draft">Lưu bản nháp</option><option value="published">Xuất bản công khai</option>
            </select>
          </Field>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 font-semibold">
            <input type="checkbox" checked={form.isFeatured} onChange={(event) => onFormChange({ ...form, isFeatured: event.target.checked })} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary" />
            Đánh dấu bài viết nổi bật
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={isSaving} onClick={onClose} className="min-h-11 rounded-xl border border-outline-variant px-5 font-bold">Hủy</button>
          <button type="submit" disabled={isSaving || isUploading} className="min-h-11 rounded-xl bg-primary px-6 font-bold text-on-primary hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50">
            {isSaving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo bài viết"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
