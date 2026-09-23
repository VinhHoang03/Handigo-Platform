import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  newsApi,
  type NewsArticlePayload,
  type NewsArticleRecord,
} from "@/features/content/api/news.api";
import { getErrorMessage } from "@/utils/apiError";
import { emptyNewsForm, toNewsForm } from "./news.constants";

/**
 * Toàn bộ state + hành động của trang quản lý tin tức. Tách khỏi
 * `AdminNewsPage` để trang chính chỉ còn lo bố cục (bảng, modal).
 */
export function useAdminNewsController() {
  const [articles, setArticles] = useState<NewsArticleRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [editing, setEditing] = useState<NewsArticleRecord | null>(null);
  const [form, setForm] = useState<NewsArticlePayload>(emptyNewsForm);
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
    setForm({ ...emptyNewsForm, content: [{ type: "paragraph", text: "" }] });
    setError("");
    setIsFormOpen(true);
  };

  const openEdit = (article: NewsArticleRecord) => {
    setEditing(article);
    setForm(toNewsForm(article));
    setError("");
    setIsFormOpen(true);
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
            ? { type: "list", items: block.items.map((item) => item.trim()).filter(Boolean) }
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

  return {
    search,
    setSearch,
    status,
    setStatus,
    visibleArticles,
    stats,
    editing,
    form,
    setForm,
    isFormOpen,
    setIsFormOpen,
    deleteTarget,
    setDeleteTarget,
    isLoading,
    isSaving,
    isUploading,
    error,
    notice,
    load,
    openCreate,
    openEdit,
    uploadCover,
    save,
    confirmDelete,
  };
}
