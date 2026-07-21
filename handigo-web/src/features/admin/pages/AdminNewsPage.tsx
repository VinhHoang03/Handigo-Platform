import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { getErrorMessage } from "@/utils/apiError";
import {
  newsApi,
  type NewsArticlePayload,
  type NewsArticleRecord,
  type NewsContentBlock,
} from "@/features/content/api/news.api";

const emptyForm: NewsArticlePayload = {
  title: "",
  excerpt: "",
  category: "Thông báo hệ thống",
  coverImage: "",
  authorName: "Ban biên tập Handigo",
  content: [{ type: "paragraph", text: "" }],
  status: "draft",
  isFeatured: false,
};

const blockLabels: Record<NewsContentBlock["type"], string> = {
  paragraph: "Đoạn văn",
  heading: "Tiêu đề mục",
  quote: "Trích dẫn / lưu ý",
  list: "Danh sách",
};

const toForm = (article: NewsArticleRecord): NewsArticlePayload => ({
  title: article.title,
  excerpt: article.excerpt,
  category: article.category,
  coverImage: article.coverImage,
  authorName: article.authorName,
  content: article.content.map((block) =>
    block.type === "list"
      ? { type: "list", items: [...block.items] }
      : { type: block.type, text: block.text },
  ),
  status: article.status,
  isFeatured: article.isFeatured,
});

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<NewsArticleRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [editing, setEditing] = useState<NewsArticleRecord | null>(null);
  const [form, setForm] = useState<NewsArticlePayload>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsArticleRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setArticles(await newsApi.listAdmin());
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Không thể tải danh sách bài viết."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleArticles = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return articles.filter((article) => {
      const matchesStatus = status === "all" || article.status === status;
      const matchesSearch =
        !keyword ||
        article.title.toLocaleLowerCase("vi").includes(keyword) ||
        article.category.toLocaleLowerCase("vi").includes(keyword);
      return matchesStatus && matchesSearch;
    });
  }, [articles, search, status]);

  const stats = useMemo(
    () => ({
      total: articles.length,
      published: articles.filter((article) => article.status === "published").length,
      drafts: articles.filter((article) => article.status === "draft").length,
    }),
    [articles],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, content: [{ type: "paragraph", text: "" }] });
    setError("");
    setIsFormOpen(true);
  };

  const openEdit = (article: NewsArticleRecord) => {
    setEditing(article);
    setForm(toForm(article));
    setError("");
    setIsFormOpen(true);
  };

  const updateBlock = (index: number, block: NewsContentBlock) => {
    setForm((current) => ({
      ...current,
      content: current.content.map((item, itemIndex) =>
        itemIndex === index ? block : item,
      ),
    }));
  };

  const changeBlockType = (index: number, type: NewsContentBlock["type"]) => {
    updateBlock(
      index,
      type === "list"
        ? { type: "list", items: [""] }
        : { type, text: "" },
    );
  };

  const addBlock = (type: NewsContentBlock["type"]) => {
    setForm((current) => ({
      ...current,
      content: [
        ...current.content,
        type === "list" ? { type: "list", items: [""] } : { type, text: "" },
      ],
    }));
  };

  const removeBlock = (index: number) => {
    setForm((current) => ({
      ...current,
      content: current.content.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const uploadCover = async (file: File) => {
    setIsUploading(true);
    setError("");
    try {
      const asset = await newsApi.uploadCover(file);
      setForm((current) => ({ ...current, coverImage: asset.url }));
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Không thể tải ảnh bìa."));
    } finally {
      setIsUploading(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.content.length) {
      setError("Bài viết phải có ít nhất một khối nội dung.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: NewsArticlePayload = {
        ...form,
        content: form.content.map((block) =>
          block.type === "list"
            ? {
                type: "list",
                items: block.items.map((item) => item.trim()).filter(Boolean),
              }
            : { type: block.type, text: block.text.trim() },
        ),
      };
      if (editing) {
        await newsApi.update(editing.id, payload);
        setNotice("Đã cập nhật bài viết.");
      } else {
        await newsApi.create(payload);
        setNotice("Đã tạo bài viết mới.");
      }
      setIsFormOpen(false);
      await load();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Không thể lưu bài viết."));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await newsApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      setNotice("Đã xóa bài viết.");
      await load();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Không thể xóa bài viết."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Quản lý tin tức
            </h1>
            <p className="mt-1 text-on-surface-variant">
              Soạn thảo, lưu nháp và xuất bản nội dung trên trang tin tức.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-on-primary shadow-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <span aria-hidden="true" className="material-symbols-outlined block text-[20px] leading-none">
              add
            </span>
            Đăng bài mới
          </button>
        </header>

        {(error || notice) && (
          <p aria-live="polite" className={`rounded-xl px-4 py-3 ${error ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-700"}`}>
            {error || notice}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon="article" label="Tổng bài quản trị" value={stats.total} />
          <Stat icon="public" label="Đã xuất bản" value={stats.published} />
          <Stat icon="draft" label="Bản nháp" value={stats.drafts} />
        </div>

        <section className="rounded-xl border border-outline-variant/20 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-outline-variant/20 p-4 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
                search
              </span>
              <input
                value={search}
                name="newsSearch"
                autoComplete="off"
                aria-label="Tìm bài viết"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tiêu đề hoặc danh mục…"
                className="min-h-11 w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest pl-10 pr-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="min-h-11 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 outline-none focus:border-primary"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản</option>
              <option value="draft">Bản nháp</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-left text-xs uppercase tracking-wider text-on-surface-variant">
                  <th className="px-5 py-4">Bài viết</th>
                  <th className="px-5 py-4">Danh mục</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4">Cập nhật</th>
                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {isLoading && (
                  <tr><td colSpan={5} className="p-10 text-center text-on-surface-variant">Đang tải bài viết…</td></tr>
                )}
                {!isLoading && visibleArticles.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-on-surface-variant">Chưa có bài viết phù hợp.</td></tr>
                )}
                {!isLoading && visibleArticles.map((article) => (
                  <tr key={article.id} className="hover:bg-surface-container-low/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img src={article.coverImage} alt="" width="80" height="56" loading="lazy" className="h-14 w-20 rounded-lg object-cover" />
                        <div className="min-w-0">
                          <p className="max-w-md truncate font-bold text-on-surface">{article.title}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{article.authorName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">{article.category}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${article.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {article.status === "published" ? "Đã xuất bản" : "Bản nháp"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">
                      {new Date(article.updatedAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => openEdit(article)} aria-label={`Sửa ${article.title}`} className="grid h-10 w-10 place-items-center rounded-lg text-primary hover:bg-primary/10">
                          <span className="material-symbols-outlined block text-[20px] leading-none">edit</span>
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(article)} aria-label={`Xóa ${article.title}`} className="grid h-10 w-10 place-items-center rounded-lg text-error hover:bg-error/10">
                          <span className="material-symbols-outlined block text-[20px] leading-none">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={isFormOpen} title={editing ? "Chỉnh sửa bài viết" : "Đăng bài mới"} size="xl" onClose={() => setIsFormOpen(false)} closeOnOverlayClick={!isSaving}>
        <form className="space-y-6" onSubmit={save}>
          {error && (
            <p role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-error">
              {error}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tiêu đề bài viết" className="md:col-span-2">
              <input required minLength={5} maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="min-h-11 w-full rounded-xl border border-outline-variant/40 bg-white px-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            </Field>
            <Field label="Danh mục">
              <input required maxLength={80} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="min-h-11 w-full rounded-xl border border-outline-variant/40 bg-white px-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" list="news-categories" />
              <datalist id="news-categories">
                <option value="Thông báo hệ thống" /><option value="Mẹo sửa chữa" /><option value="Khuyến mãi" /><option value="Tin tức cộng đồng" />
              </datalist>
            </Field>
            <Field label="Tên tác giả">
              <input required maxLength={120} value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} className="min-h-11 w-full rounded-xl border border-outline-variant/40 bg-white px-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            </Field>
            <Field label="Mô tả ngắn" className="md:col-span-2">
              <textarea required minLength={10} maxLength={500} rows={3} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} className="w-full resize-y rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            </Field>
          </div>

          <section className="rounded-2xl border border-outline-variant/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-bold text-on-surface">Ảnh bìa</h3><p className="text-sm text-on-surface-variant">Ảnh ngang, rõ nét và phù hợp với nội dung bài.</p></div>
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-primary px-4 text-sm font-bold text-primary">
                <span className="material-symbols-outlined block text-[19px] leading-none">upload</span>
                {isUploading ? "Đang tải…" : "Tải ảnh"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={isUploading} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.target.value = ""; }} />
              </label>
            </div>
            {form.coverImage && <img src={form.coverImage} alt="Xem trước ảnh bìa" width="1200" height="630" className="mt-4 h-52 w-full rounded-xl object-cover" />}
            <input required type="url" maxLength={1000} value={form.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} placeholder="Hoặc nhập URL ảnh bìa" className="mt-4 min-h-11 w-full rounded-xl border border-outline-variant/40 bg-white px-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-bold text-on-surface">Nội dung bài viết</h3><p className="text-sm text-on-surface-variant">Chọn định dạng riêng cho từng khối nội dung.</p></div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(blockLabels) as NewsContentBlock["type"][]).map((type) => (
                  <button key={type} type="button" onClick={() => addBlock(type)} className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary">+ {blockLabels[type]}</button>
                ))}
              </div>
            </div>

            {form.content.map((block, index) => (
              <div key={index} className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary">{index + 1}</span>
                  <select value={block.type} onChange={(event) => changeBlockType(index, event.target.value as NewsContentBlock["type"])} className="min-h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm font-semibold outline-none focus:border-primary">
                    {(Object.keys(blockLabels) as NewsContentBlock["type"][]).map((type) => <option key={type} value={type}>{blockLabels[type]}</option>)}
                  </select>
                  <button type="button" disabled={form.content.length === 1} onClick={() => removeBlock(index)} className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-error hover:bg-error/10 disabled:opacity-30" aria-label={`Xóa khối ${index + 1}`}>
                    <span className="material-symbols-outlined block text-[20px] leading-none">delete</span>
                  </button>
                </div>
                {block.type === "list" ? (
                  <textarea required rows={4} value={block.items.join("\n")} onChange={(event) => updateBlock(index, { type: "list", items: event.target.value.split("\n") })} placeholder="Mỗi dòng là một mục trong danh sách" className="w-full resize-y rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                ) : (
                  <textarea required rows={block.type === "heading" ? 2 : 4} maxLength={5000} value={block.text} onChange={(event) => updateBlock(index, { type: block.type, text: event.target.value })} placeholder={blockLabels[block.type]} className="w-full resize-y rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                )}
              </div>
            ))}
          </section>

          <div className="grid gap-4 rounded-2xl bg-surface-container-low p-4 sm:grid-cols-2 sm:items-center">
            <Field label="Trạng thái">
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as NewsArticlePayload["status"] })} className="min-h-11 w-full rounded-xl border border-outline-variant/40 bg-white px-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                <option value="draft">Lưu bản nháp</option><option value="published">Xuất bản công khai</option>
              </select>
            </Field>
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-outline-variant/30 bg-white px-4 font-semibold">
              <input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary" />
              Đánh dấu bài viết nổi bật
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" disabled={isSaving} onClick={() => setIsFormOpen(false)} className="min-h-11 rounded-xl border border-outline-variant px-5 font-bold">Hủy</button>
            <button type="submit" disabled={isSaving || isUploading} className="min-h-11 rounded-xl bg-primary px-6 font-bold text-on-primary hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50">{isSaving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo bài viết"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="Xóa bài viết" danger onClose={() => setDeleteTarget(null)} size="sm">
        <p className="text-on-surface-variant">Bạn chắc chắn muốn xóa bài “{deleteTarget?.title}”? Bài viết sẽ không còn hiển thị công khai.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-xl border border-outline-variant px-5 font-bold">Hủy</button>
          <button type="button" disabled={isSaving} onClick={() => void confirmDelete()} className="min-h-11 rounded-xl bg-error px-5 font-bold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/20 disabled:opacity-50">{isSaving ? "Đang xóa…" : "Xóa bài viết"}</button>
        </div>
      </Modal>
    </DashboardShell>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-white p-5 shadow-sm">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <span aria-hidden="true" className="material-symbols-outlined block text-[24px] leading-none">{icon}</span>
      </span>
      <div><p className="text-sm text-on-surface-variant">{label}</p><p className="text-2xl font-bold text-on-surface">{value}</p></div>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-bold text-on-surface">{label}</span>{children}</label>;
}
