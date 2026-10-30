import { Upload } from "lucide-react";
import type { NewsArticlePayload } from "@/features/content/api/news.api";

interface Props {
  form: NewsArticlePayload;
  onChange: (form: NewsArticlePayload) => void;
  onUpload: (file: File) => void;
  isUploading: boolean;
}

const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export function NewsEditorSidebar({ form, onChange, onUpload, isUploading }: Props) {
  return (
    <aside aria-label="Thông tin bài viết" className="space-y-5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 xl:sticky xl:top-24">
      <div><h2 className="font-bold text-on-surface">Thông tin bài viết</h2><p className="mt-1 text-sm text-on-surface-variant">Hoàn thiện trước khi xuất bản.</p></div>
      <label className="block text-sm font-semibold">Danh mục
        <input value={form.category} maxLength={80} list="news-categories" onChange={event => onChange({ ...form, category: event.target.value })} className={inputClass} />
        <datalist id="news-categories"><option value="Thông báo hệ thống" /><option value="Mẹo sửa chữa" /><option value="Khuyến mãi" /><option value="Tin tức cộng đồng" /></datalist>
      </label>
      <label className="block text-sm font-semibold">Tác giả
        <input value={form.authorName} maxLength={120} onChange={event => onChange({ ...form, authorName: event.target.value })} className={inputClass} />
      </label>
      <div className="space-y-3 border-t border-outline-variant/30 pt-5">
        <h3 className="text-sm font-semibold">Ảnh bìa</h3>
        {form.coverImage ? <img src={form.coverImage} alt="Xem trước ảnh bìa" className="aspect-[16/9] w-full rounded-xl object-cover" />
          : <div className="grid aspect-[16/9] place-items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low text-sm text-on-surface-variant">Chưa có ảnh bìa</div>}
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container-low">
          <Upload size={18} aria-hidden="true" />{isUploading ? "Đang tải ảnh…" : "Tải ảnh bìa"}
          <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/avif" disabled={isUploading} onChange={event => {
            const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = "";
          }} />
        </label>
        <label className="block text-xs text-on-surface-variant">Hoặc nhập đường dẫn ảnh
          <input type="url" value={form.coverImage} maxLength={1000} placeholder="https://…" onChange={event => onChange({ ...form, coverImage: event.target.value })} className={inputClass} />
        </label>
      </div>
      <label className="flex items-start gap-3 border-t border-outline-variant/30 pt-5 text-sm font-semibold">
        <input type="checkbox" checked={form.isFeatured} onChange={event => onChange({ ...form, isFeatured: event.target.checked })} className="mt-0.5 size-4 accent-primary" />Đánh dấu bài viết nổi bật
      </label>
      <p className="text-xs leading-5 text-on-surface-variant">Bản đang soạn tự lưu trên trình duyệt này. Lưu nháp lên hệ thống để tiếp tục trên thiết bị khác khi đã đủ thông tin.</p>
    </aside>
  );
}
