import type {
  NewsArticlePayload,
  NewsArticleRecord,
} from "@/features/content/api/news.api";
import { toneChipClasses } from "@/utils/statusTone";

export const emptyNewsForm: NewsArticlePayload = {
  title: "",
  excerpt: "",
  category: "Thông báo hệ thống",
  coverImage: "",
  authorName: "Ban biên tập Handigo",
  content: [{ type: "paragraph", text: "" }],
  status: "draft",
  isFeatured: false,
};

export const toNewsForm = (article: NewsArticleRecord): NewsArticlePayload => ({
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
  ...(article.richContent ? { richContent: structuredClone(article.richContent) } : {}),
  status: article.status,
  isFeatured: article.isFeatured,
});

export const NEWS_STATUS_LABELS: Record<NewsArticleRecord["status"], string> = {
  published: "Đã xuất bản",
  draft: "Bản nháp",
};

/** published -> tông thành công, draft -> trung tính (đồng bộ statusTone.ts toàn hệ thống). */
export const newsStatusChipClass = (status: NewsArticleRecord["status"]) =>
  toneChipClasses[status === "published" ? "success" : "neutral"];
