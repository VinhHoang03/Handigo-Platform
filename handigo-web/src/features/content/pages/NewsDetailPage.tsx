import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { newsApi } from "../api/news.api";
import { PublicContentLayout } from "../components/PublicContentLayout";
import { newsArticles } from "../data/content.data";
import {
  mergeNewsArticles,
  toNewsViewArticle,
  toStaticNewsViewArticle,
  type NewsViewArticle,
} from "../utils/newsView";

export default function NewsDetailPage() {
  const { articleId } = useParams();
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

  if (isLoading) {
    return (
      <PublicContentLayout>
        <div className="mx-auto max-w-4xl px-6 py-20 text-center text-on-surface-variant">
          Đang tải bài viết…
        </div>
      </PublicContentLayout>
    );
  }

  if (error || !article) {
    return (
      <PublicContentLayout>
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="text-error">{error || "Không tìm thấy bài viết."}</p>
          <Link to="/tin-tuc" className="mt-5 inline-flex font-semibold text-primary">
            Quay lại trang tin tức
          </Link>
        </div>
      </PublicContentLayout>
    );
  }

  return (
    <PublicContentLayout>
      <article className="mx-auto max-w-4xl px-6 py-10 lg:py-16">
        <Link
          to="/tin-tuc"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full border border-primary/20">
            <span aria-hidden="true" className="material-symbols-outlined block text-[18px] leading-none">
              arrow_back
            </span>
          </span>
          Quay lại Tin tức
        </Link>

        <div className="mt-8 text-center">
          <span className="rounded-full bg-primary-fixed px-4 py-2 text-xs font-bold text-primary">
            {article.category}
          </span>
          <h1 className="mt-6 font-headline-xl text-4xl font-bold leading-tight text-on-surface sm:text-5xl">
            {article.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-on-surface-variant">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-white">
              HD
            </span>
            <span className="font-semibold text-on-surface">
              {article.authorName}
            </span>
            <span>•</span>
            <span>{article.date}</span>
            <span>•</span>
            <span>{article.readTime}</span>
          </div>
        </div>

        <img
          src={article.image}
          alt={article.title}
          width={1200}
          height={720}
          className="mt-10 h-[280px] w-full rounded-3xl object-cover shadow-lg sm:h-[460px]"
        />

        <div className="mx-auto mt-10 max-w-3xl space-y-6 text-base leading-8 text-on-surface-variant">
          <p className="text-xl font-medium leading-8 text-on-surface">
            {article.excerpt}
          </p>
          {article.content.map((block, index) => {
            const key = `${block.type}-${index}`;
            if (block.type === "heading") {
              return (
                <h2 key={key} className="pt-4 text-3xl font-bold text-primary">
                  {block.text}
                </h2>
              );
            }
            if (block.type === "quote") {
              return (
                <blockquote
                  key={key}
                  className="rounded-2xl border-l-4 border-secondary bg-surface-container-low p-6 font-medium text-on-surface"
                >
                  {block.text}
                </blockquote>
              );
            }
            if (block.type === "list") {
              return (
                <ul key={key} className="space-y-2 pl-5">
                  {block.items.map((item) => (
                    <li key={item} className="list-disc pl-1">
                      {item}
                    </li>
                  ))}
                </ul>
              );
            }
            return <p key={key}>{block.text}</p>;
          })}
        </div>
      </article>

      {related.length > 0 && (
        <section className="bg-surface-container-low px-6 py-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-7 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-primary">
                Bài viết liên quan
              </h2>
              <Link to="/tin-tuc" className="text-sm font-semibold text-primary">
                Xem tất cả
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  to={`/tin-tuc/${item.slug}`}
                  className="group overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-lg"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    width={640}
                    height={320}
                    loading="lazy"
                    className="h-40 w-full object-cover transition group-hover:scale-105"
                  />
                  <h3 className="p-5 font-bold leading-6 group-hover:text-primary">
                    {item.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </PublicContentLayout>
  );
}
