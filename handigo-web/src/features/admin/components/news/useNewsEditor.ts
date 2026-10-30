import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { newsApi, type NewsArticlePayload, type NewsArticleRecord } from "@/features/content/api/news.api";
import { getErrorMessage } from "@/utils/apiError";
import { emptyNewsForm, toNewsForm } from "./news.constants";
import { newsDraftKey, normalizeNewsContent, readNewsDraft, validateNewsForm, writeNewsDraft } from "./newsDraft";
import { newsBlocksFromRichContent, normalizeNewsRichContent } from "@/features/content/utils/newsRichContent";

export function useNewsEditor(userId: string, articleId?: string) {
  const navigate = useNavigate();
  const key = newsDraftKey(userId, articleId);
  const [initial] = useState(() => {
    try { return { draft: readNewsDraft(localStorage, key), failed: false }; }
    catch { return { draft: null, failed: true }; }
  });
  const [form, setForm] = useState<NewsArticlePayload>(initial.draft?.form ?? structuredClone(emptyNewsForm));
  const [article, setArticle] = useState<NewsArticleRecord | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(articleId));
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [savedAt, setSavedAt] = useState(initial.draft?.savedAt ?? "");
  const [storageFailed, setStorageFailed] = useState(initial.failed);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initial.draft ? "Đã khôi phục bản đang soạn trên trình duyệt này." : "");
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!articleId) return;
    let active = true;
    void newsApi.listAdmin().then(articles => {
      if (!active) return;
      const found = articles.find(item => item.id === articleId);
      if (!found) throw new Error("Bài viết không tồn tại hoặc đã bị xóa.");
      setArticle(found);
      setForm(initial.draft?.form ?? toNewsForm(found));
    }).catch(err => { if (active) setLoadError(getErrorMessage(err, "Không thể tải bài viết.")); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [articleId, initial, revision]);

  useEffect(() => {
    if (!storageFailed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed]);

  const persist = (next: NewsArticlePayload) => {
    try {
      const draft = writeNewsDraft(localStorage, key, next);
      setSavedAt(draft.savedAt);
      setStorageFailed(false);
      return true;
    } catch { setStorageFailed(true); return false; }
  };

  const change = (next: NewsArticlePayload) => {
    setForm(next);
    persist(next);
    setNotice("");
    setError("");
  };

  const save = async (status: "draft" | "published") => {
    if (isSaving || isUploading || isLoading || loadError) return;
    const localSaved = persist(form);
    const validation = validateNewsForm(form);
    setError("");
    setNotice("");
    // Bản đang sửa của bài công khai được giữ riêng, không tự chuyển bài thành nháp.
    if (status === "draft" && (validation || article?.status === "published")) {
      if (localSaved) setNotice(article?.status === "published"
        ? "Đã lưu bản đang soạn trên trình duyệt. Bấm Cập nhật bài viết để áp dụng lên bài công khai."
        : `Đã lưu nháp trên trình duyệt. Để lưu lên hệ thống: ${validation}`);
      return;
    }
    if (validation) { setError(validation); return; }
    setIsSaving(true);
    try {
      const richContent = form.richContent ? normalizeNewsRichContent(form.richContent) : undefined;
      const payload = { ...form, status, ...(richContent ? { richContent } : {}), content: normalizeNewsContent(richContent ? newsBlocksFromRichContent(richContent) : form.content) };
      const result = articleId ? await newsApi.update(articleId, payload) : await newsApi.create(payload);
      const next = toNewsForm(result);
      // Chỉ xóa bản khôi phục sau khi máy chủ đã lưu thành công.
      try { localStorage.removeItem(key); } catch { /* Giữ bản cục bộ nếu trình duyệt chặn truy cập. */ }
      if (!active.current) return;
      setArticle(result);
      setForm(next);
      setSavedAt("");
      setStorageFailed(false);
      setNotice(status === "draft" ? "Đã lưu bản nháp lên hệ thống." : "Đã lưu và xuất bản bài viết.");
      if (!articleId) navigate(`/admin/news/${result.id}/edit`, { replace: true });
    } catch (err) { setError(getErrorMessage(err, "Không thể lưu lên hệ thống. Bản đang soạn vẫn được giữ nếu lưu trình duyệt thành công.")); }
    finally { setIsSaving(false); }
  };

  const uploadCover = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type)) {
      setError("Chỉ hỗ trợ ảnh PNG, JPEG, WebP hoặc AVIF."); return;
    }
    setIsUploading(true);
    setError("");
    try {
      const asset = await newsApi.uploadCover(file);
      return asset.url;
    } catch (err) { setError(getErrorMessage(err, "Không thể tải ảnh bìa.")); }
    finally { setIsUploading(false); }
  };

  const discard = () => {
    try {
      localStorage.removeItem(key);
      setForm(article ? toNewsForm(article) : structuredClone(emptyNewsForm));
      setSavedAt("");
      setStorageFailed(false);
      setError("");
      setNotice("Đã bỏ bản đang soạn trên trình duyệt.");
    } catch { setError("Không thể xóa bản đang soạn trên trình duyệt."); }
  };

  return { form, article, change, save, uploadCover, discard, isLoading, loadError, isSaving, isUploading,
    savedAt, storageFailed, error, notice,
    retry: () => { setLoadError(""); setIsLoading(true); setRevision(value => value + 1); } };
}
