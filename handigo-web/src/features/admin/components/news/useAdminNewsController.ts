import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  newsApi,
  type NewsArticleRecord,
} from "@/features/content/api/news.api";
import { getErrorMessage } from "@/utils/apiError";
import { useNavigate } from "react-router-dom";

/** Quản lý danh sách, bộ lọc và thao tác xóa bài viết. */
export function useAdminNewsController() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<NewsArticleRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [deleteTarget, setDeleteTarget] = useState<NewsArticleRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useToastFeedback<string>("", "error");
  const [notice, setNotice] = useToastFeedback<string>("", "success");

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
  }, [setError]);

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

  const openCreate = () => navigate("/admin/news/new");
  const openEdit = (article: NewsArticleRecord) => navigate(`/admin/news/${article.id}/edit`);

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
    deleteTarget,
    setDeleteTarget,
    isLoading,
    isSaving,
    error,
    notice,
    load,
    openCreate,
    openEdit,
    confirmDelete,
  };
}
