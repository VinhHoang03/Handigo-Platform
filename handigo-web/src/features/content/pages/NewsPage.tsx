import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { newsApi, type NewsArticleRecord } from "../api/news.api";
import { PublicContentLayout } from "../components/PublicContentLayout";
import { newsArticles, newsCategories } from "../data/content.data";
import { mergeNewsArticles } from "../utils/newsView";

export default function NewsPage() {
  const [category, setCategory] = useState("Tất cả");
  const [records, setRecords] = useState<NewsArticleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await newsApi.listPublished();
        if (active) setRecords(data);
      } catch {
        if (active) {
          setLoadError(
            "Chưa thể tải các bài viết mới. Các bài viết hiện có vẫn được hiển thị.",
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
  }, []);

  const articles = useMemo(
    () => mergeNewsArticles(records, newsArticles),
    [records],
  );
  const categories = useMemo(
    () => [
      ...newsCategories,
      ...records
        .map((article) => article.category)
        .filter((item) => !newsCategories.includes(item)),
    ],
    [records],
  );
  const featuredArticle =
    articles.find((article) => article.isFeatured) || articles[0];
  const visibleArticles =
    category === "Tất cả"
      ? articles
      : articles.filter((article) => article.category === category);

  return (
    <PublicContentLayout>
      {featuredArticle && (
        <section className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
          <div className="grid overflow-hidden rounded-3xl bg-primary text-on-primary shadow-xl lg:grid-cols-2">
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <span className="w-fit rounded-full bg-on-primary/15 px-4 py-2 text-xs font-bold uppercase tracking-wider">
                Nổi bật
              </span>
              <h1 className="mt-6 font-headline-xl text-3xl font-bold leading-tight sm:text-5xl">
                {featuredArticle.title}
              </h1>
              <p className="mt-5 leading-7 text-on-primary/80">
                {featuredArticle.excerpt}
              </p>
              {/* Một nút duy nhất. Trước đây có thêm "Xem bài viết" trỏ xuống
                  danh sách ngay bên dưới: hai nút, hai nhãn, cùng một ý "đọc
                  bài", buộc người dùng phải đoán xem chúng khác nhau chỗ nào. */}
              <div className="mt-7">
                <Link
                  to={`/tin-tuc/${featuredArticle.slug}`}
                  className="inline-flex min-h-14 items-center rounded-xl bg-on-primary px-6 py-3 font-semibold text-primary"
                >
                  Đọc bài viết
                </Link>
              </div>
            </div>
            <img
              src={featuredArticle.image}
              alt={featuredArticle.title}
              width={1200}
              height={720}
              fetchPriority="high"
              className="h-full min-h-72 w-full object-cover"
            />
          </div>
        </section>
      )}

      <section id="danh-sach" className="mx-auto max-w-7xl px-6 py-3 lg:py-0">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-secondary">
              Góc Handigo
            </p>
            <h2 className="mt-2 font-headline-lg text-3xl font-bold text-primary">
              Tin tức mới nhất
            </h2>
          </div>
          <div
            className="flex max-w-full gap-2 overflow-x-auto pb-2"
            role="tablist"
            aria-label="Lọc bài viết"
          >
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={category === item}
                onClick={() => setCategory(item)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                  category === item
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:text-primary"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {(isLoading || loadError) && (
          <p
            className={`mb-5 rounded-xl px-4 py-3 text-sm ${
              loadError
                ? "bg-error/10 text-error"
                : "bg-primary/5 text-on-surface-variant"
            }`}
          >
            {loadError || "Đang cập nhật các bài viết mới nhất…"}
          </p>
        )}

        {visibleArticles.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleArticles.map((article) => (
              <Link
                key={`${article.id}-${article.slug}`}
                to={`/tin-tuc/${article.slug}`}
                className="group overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"
              >
                <div className="h-52 overflow-hidden">
                  <img
                    src={article.image}
                    alt={article.title}
                    width={640}
                    height={416}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-primary">
                    {article.category}
                  </span>
                  <h3 className="mt-4 line-clamp-2 text-xl font-bold leading-7 text-on-surface group-hover:text-primary">
                    {article.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-on-surface-variant">
                    {article.excerpt}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-outline-variant/20 pt-4 text-xs text-on-surface-variant">
                    <span>{article.date}</span>
                    <span>{article.readTime}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-surface-container-low p-12 text-center text-on-surface-variant">
            Chưa có bài viết trong danh mục này.
          </div>
        )}
      </section>
    </PublicContentLayout>
  );
}
