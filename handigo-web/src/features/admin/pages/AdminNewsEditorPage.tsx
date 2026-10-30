import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Eye, FileEdit, Save, Send } from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { NewsArticleContent } from "@/features/content/components/NewsArticleContent";
import { NewsRichTextEditor } from "../components/news/NewsRichTextEditor";
import { NewsEditorSidebar } from "../components/news/NewsEditorSidebar";
import { useNewsEditor } from "../components/news/useNewsEditor";

export default function AdminNewsEditorPage() {
  const { articleId } = useParams();
  const user = useAuthStore(state => state.user);
  const userId = user?.id ?? user?._id;
  if (!userId) return <p role="status">Đang tải tài khoản…</p>;
  return <NewsEditor key={`${userId}:${articleId ?? "new"}`} userId={userId} articleId={articleId} />;
}

function NewsEditor({ userId, articleId }: { userId: string; articleId?: string }) {
  const editor = useNewsEditor(userId, articleId);
  const [preview, setPreview] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const { form, change } = editor;
  const busy = editor.isSaving || editor.isUploading;
  const published = editor.article?.status === "published";
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/admin/news" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={18} aria-hidden="true" />Trở về danh sách tin tức</Link>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">{articleId ? "Chỉnh sửa bài viết" : "Soạn bài viết mới"}</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Tin tức / {articleId ? "Chỉnh sửa bài viết" : "Tạo bài mới"}</p>
        </div>
        {!editor.isLoading && !editor.loadError && <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPreview(!preview)} aria-pressed={preview} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant px-4 text-sm font-semibold">{preview ? <FileEdit size={18} /> : <Eye size={18} />}{preview ? "Tiếp tục soạn" : "Xem trước"}</button>
          <button type="button" disabled={busy} onClick={() => void editor.save("draft")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-40"><Save size={18} />{published ? "Lưu bản đang soạn" : "Lưu nháp"}</button>
          <button type="button" disabled={busy} onClick={() => void editor.save("published")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary disabled:opacity-40"><Send size={18} />{editor.isSaving ? "Đang lưu…" : published ? "Cập nhật bài viết" : "Xuất bản"}</button>
        </div>}
      </header>
      {editor.isLoading ? <div role="status" className="rounded-2xl bg-surface-container-low p-10">Đang tải bài viết…</div> : editor.loadError ?
        <div role="alert" className="rounded-xl border border-error/30 p-5 text-error"><p>{editor.loadError}</p><button type="button" onClick={editor.retry} className="mt-3 min-h-11 font-semibold underline">Thử lại</button></div> : <>
          <div aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
            <Check size={16} aria-hidden="true" />{editor.savedAt ? `Đã lưu trên trình duyệt lúc ${new Date(editor.savedAt).toLocaleTimeString("vi-VN")}` : "Thay đổi được tự lưu trên trình duyệt này"}
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{published ? "Bài đã xuất bản" : "Bản nháp"}</span>
          </div>
          {editor.storageFailed && <p role="alert" className="rounded-xl bg-error/10 p-4 text-sm text-error">Trình duyệt không thể lưu bản đang soạn. Hãy sao chép nội dung hoặc lưu lên hệ thống trước khi rời trang.</p>}
          {editor.error && <p role="alert" className="rounded-xl bg-error/10 p-4 text-sm text-error">{editor.error}</p>}
          {editor.notice && <p role="status" className="rounded-xl bg-primary/10 p-4 text-sm text-primary">{editor.notice}</p>}
          {editor.savedAt && <button type="button" disabled={busy} onClick={() => setDiscardOpen(true)} className="min-h-10 text-sm font-semibold text-error underline disabled:opacity-40">Bỏ bản đang soạn trên trình duyệt</button>}
          <fieldset disabled={busy} className="grid min-w-0 items-start gap-6 disabled:opacity-70 xl:grid-cols-[minmax(0,1fr)_300px]">
            <legend className="sr-only">Soạn bài viết</legend>
            <div className="min-w-0 overflow-clip rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
              {preview ? <article aria-label="Xem trước bài viết" className="space-y-6 p-6 sm:p-10">
                <p className="text-sm font-semibold text-primary">{form.category}</p>
                <h2 className="break-words text-4xl font-bold leading-tight">{form.title || "Tiêu đề bài viết"}</h2>
                <p className="text-sm text-on-surface-variant">{form.authorName}</p>
                {form.coverImage && <img src={form.coverImage} alt={form.title || "Ảnh bìa"} className="aspect-[16/9] w-full rounded-xl object-cover" />}
                <p className="text-xl font-medium leading-8">{form.excerpt}</p>
                <div className="space-y-6 break-words whitespace-pre-wrap text-base leading-8 text-on-surface-variant"><NewsArticleContent content={form.content} richContent={form.richContent} /></div>
              </article> : <>
                <div className="space-y-5 px-6 py-8 sm:px-10">
                  <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Tiêu đề bài viết</span>
                    <textarea rows={2} maxLength={200} value={form.title} onChange={event => change({ ...form, title: event.target.value })} placeholder="Nhập tiêu đề bài viết…" className="w-full resize-y bg-transparent text-3xl font-bold leading-tight outline-none placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 sm:text-4xl" />
                  </label>
                  <label className="block"><span className="mb-2 block text-sm font-semibold text-on-surface-variant">Mô tả ngắn</span>
                    <textarea rows={3} maxLength={500} value={form.excerpt} onChange={event => change({ ...form, excerpt: event.target.value })} placeholder="Tóm tắt nội dung để người đọc nắm được điểm chính…" className="w-full resize-y bg-transparent text-lg leading-8 outline-none placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/20" />
                    <span className="text-xs text-on-surface-variant">{form.excerpt.length}/500 ký tự</span>
                  </label>
                </div>
                <NewsRichTextEditor key={`${editor.article?.updatedAt ?? "new"}:${editorRevision}`} content={form.content} richContent={form.richContent} disabled={busy} onChange={(content, richContent) => change({ ...form, content, richContent })} />
              </>}
            </div>
            <NewsEditorSidebar form={form} onChange={change} isUploading={editor.isUploading} onUpload={file => {
              void editor.uploadCover(file).then(url => { if (url) change({ ...form, coverImage: url }); });
            }} />
          </fieldset>
        </>}
      <ConfirmDialog open={discardOpen} title="Bỏ bản đang soạn?" message="Nội dung chưa lưu lên hệ thống sẽ bị bỏ. Bài viết đã lưu trên hệ thống được giữ nguyên." variant="danger"
        onCancel={() => setDiscardOpen(false)} onConfirm={() => { editor.discard(); setDiscardOpen(false); setEditorRevision(value => value + 1); }} />
    </div>
  );
}
