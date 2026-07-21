import type {
  NewsArticleRecord,
  NewsContentBlock,
} from "../api/news.api";
import type { NewsArticle as StaticNewsArticle } from "../data/content.data";

export interface NewsViewArticle {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  image: string;
  authorName: string;
  content: NewsContentBlock[];
  isFeatured: boolean;
}

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(
        new Date(value),
      )
    : "Chưa xuất bản";

const estimateReadTime = (blocks: NewsContentBlock[]) => {
  const wordCount = blocks.reduce((total, block) => {
    const content = block.type === "list" ? block.items.join(" ") : block.text;
    return total + content.trim().split(/\s+/).filter(Boolean).length;
  }, 0);
  return `${Math.max(1, Math.ceil(wordCount / 220))} phút đọc`;
};

export const toNewsViewArticle = (
  article: NewsArticleRecord,
): NewsViewArticle => ({
  id: article.id,
  slug: article.slug,
  category: article.category,
  title: article.title,
  excerpt: article.excerpt,
  date: formatDate(article.publishedAt || article.createdAt),
  readTime: estimateReadTime(article.content),
  image: article.coverImage,
  authorName: article.authorName,
  content: article.content,
  isFeatured: article.isFeatured,
});

export const toStaticNewsViewArticle = (
  article: StaticNewsArticle,
): NewsViewArticle => ({
  id: article.id,
  slug: article.id,
  category: article.category,
  title: article.title,
  excerpt: article.excerpt,
  date: article.date,
  readTime: article.readTime,
  image: article.image,
  authorName: "Ban biên tập Handigo",
  content: article.content || [{ type: "paragraph", text: article.excerpt }],
  isFeatured: false,
});

export const mergeNewsArticles = (
  records: NewsArticleRecord[],
  staticArticles: StaticNewsArticle[],
) => {
  const dynamicArticles = records.map(toNewsViewArticle);
  const dynamicSlugs = new Set(dynamicArticles.map((article) => article.slug));
  return [
    ...dynamicArticles,
    ...staticArticles
      .filter((article) => !dynamicSlugs.has(article.id))
      .map(toStaticNewsViewArticle),
  ];
};
