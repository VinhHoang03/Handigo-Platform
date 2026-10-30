import type {
  NewsArticleRecord,
  NewsContentBlock,
} from "../api/news.api";
import type { JSONContent } from "@tiptap/core";

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
  richContent?: JSONContent;
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
  richContent: article.richContent,
  isFeatured: article.isFeatured,
});

