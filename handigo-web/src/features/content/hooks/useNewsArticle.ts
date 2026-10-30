import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/utils/apiError";
import { newsApi } from "../api/news.api";
import { toNewsViewArticle, type NewsViewArticle } from "../utils/newsView";

/** Database là nguồn bài viết duy nhất; không phục hồi bài đã ẩn từ dữ liệu tĩnh. */
export function useNewsArticle(articleId?: string) {
  const [article, setArticle] = useState<NewsViewArticle | null>(null);
  const [related, setRelated] = useState<NewsViewArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>("", "error");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setArticle(null);
      setRelated([]);
      setError("");
      if (!articleId) {
        setError("Không tìm thấy bài viết.");
        setIsLoading(false);
        return;
      }
      // Lỗi tải bài liên quan không làm mất một bài chính đã tải thành công.
      const [current, others] = await Promise.allSettled([
        newsApi.getPublished(articleId), newsApi.listPublished(),
      ]);
      if (!active) return;
      if (current.status === "fulfilled") {
        setArticle(toNewsViewArticle(current.value));
        if (others.status === "fulfilled") setRelated(others.value
          .filter(item => item.slug !== current.value.slug).slice(0, 3).map(toNewsViewArticle));
      } else setError(getErrorMessage(current.reason, "Không thể tải bài viết hoặc bài viết không còn công khai."));
      setIsLoading(false);
    };
    const timer = window.setTimeout(() => void load(), 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [articleId, setError]);

  return { article, related, isLoading, error };
}
