import { useEffect, useState } from "react";
import { newsApi } from "../api/news.api";
import { newsArticles } from "../data/content.data";
import {
  mergeNewsArticles,
  toNewsViewArticle,
  toStaticNewsViewArticle,
  type NewsViewArticle,
} from "../utils/newsView";

/**
 * Tải một bài viết cùng các bài liên quan.
 *
 * Khi API lỗi, lùi về bộ bài viết tĩnh trong `content.data.ts` thay vì báo lỗi
 * ngay — trang tin tức vẫn đọc được khi backend gặp sự cố.
 */
export function useNewsArticle(articleId?: string) {
  const [article, setArticle] = useState<NewsViewArticle | null>(null);
  const [related, setRelated] = useState<NewsViewArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!articleId) return;
      try {
        const [record, records] = await Promise.all([
          newsApi.getPublished(articleId),
          newsApi.listPublished(),
        ]);
        if (!active) return;
        const current = toNewsViewArticle(record);
        setArticle(current);
        setRelated(
          mergeNewsArticles(records, newsArticles)
            .filter((item) => item.slug !== current.slug)
            .slice(0, 3),
        );
      } catch {
        if (!active) return;
        const staticArticle = newsArticles.find((item) => item.id === articleId);
        if (!staticArticle) {
          setError("Không tìm thấy bài viết.");
        } else {
          setArticle(toStaticNewsViewArticle(staticArticle));
          setRelated(
            newsArticles
              .filter((item) => item.id !== staticArticle.id)
              .slice(0, 3)
              .map(toStaticNewsViewArticle),
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [articleId]);

  return { article, related, isLoading, error };
}
