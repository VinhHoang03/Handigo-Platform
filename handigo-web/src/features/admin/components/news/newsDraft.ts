import type { NewsArticlePayload, NewsContentBlock } from "@/features/content/api/news.api";
import { isNewsRichDocument, newsBlocksFromRichContent } from "@/features/content/utils/newsRichContent";

export interface NewsDraft {
  form: NewsArticlePayload;
  savedAt: string;
}

export const newsDraftKey = (userId: string, articleId = "new") =>
  `handigo:news-draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(articleId)}`;

export function readNewsDraft(storage: Pick<Storage, "getItem">, key: string): NewsDraft | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    const form = draft?.form;
    if (!form || typeof draft.savedAt !== "string" || !Number.isFinite(Date.parse(draft.savedAt)) ||
      !["title", "excerpt", "category", "coverImage", "authorName"].every(field => typeof form[field] === "string") ||
      !["draft", "published"].includes(form.status) || typeof form.isFeatured !== "boolean" ||
      !Array.isArray(form.content) || !form.content.length || form.content.length > 100 ||
      !form.content.every((block: NewsContentBlock) => block && (
        block.type === "list" ? Array.isArray(block.items) && block.items.every(item => typeof item === "string") :
          ["paragraph", "heading", "quote"].includes(block.type) && typeof block.text === "string"
      ))) return null;
    if (form.richContent !== undefined && !isNewsRichDocument(form.richContent)) delete form.richContent;
    return { form, savedAt: draft.savedAt };
  } catch {
    return null;
  }
}

export function writeNewsDraft(storage: Pick<Storage, "setItem">, key: string, form: NewsArticlePayload): NewsDraft {
  const draft = { form, savedAt: new Date().toISOString() };
  storage.setItem(key, JSON.stringify(draft));
  return draft;
}

export const normalizeNewsContent = (content: NewsContentBlock[]): NewsContentBlock[] => content.map<NewsContentBlock>(block =>
  block.type === "list"
    ? { type: "list", items: block.items.map(item => item.trim()).filter(Boolean) }
    : { type: block.type, text: block.text.trim() },
).filter(block => block.type === "list" ? block.items.length > 0 : Boolean(block.text));

export function validateNewsForm(form: NewsArticlePayload): string {
  if (form.richContent && !isNewsRichDocument(form.richContent)) return "Nội dung định dạng quá dài hoặc có cấu trúc không hợp lệ.";
  if (form.title.trim().length < 5 || form.title.trim().length > 200) return "Tiêu đề cần từ 5 đến 200 ký tự.";
  if (form.excerpt.trim().length < 10 || form.excerpt.trim().length > 500) return "Mô tả ngắn cần từ 10 đến 500 ký tự.";
  if (form.category.trim().length < 2 || form.category.trim().length > 80) return "Danh mục cần từ 2 đến 80 ký tự.";
  if (form.authorName.trim().length < 2 || form.authorName.trim().length > 120) return "Tên tác giả cần từ 2 đến 120 ký tự.";
  try {
    const url = new URL(form.coverImage);
    if (!["http:", "https:"].includes(url.protocol) || form.coverImage.length > 1000) throw new Error();
  } catch { return "Vui lòng tải ảnh bìa hoặc nhập đường dẫn ảnh HTTP/HTTPS hợp lệ."; }
  const content = normalizeNewsContent(form.richContent ? newsBlocksFromRichContent(form.richContent) : form.content);
  if (!content.length) return "Vui lòng nhập nội dung bài viết.";
  if (content.length > 100) return "Bài viết chỉ được có tối đa 100 khối nội dung.";
  if (content.some(block => block.type === "list"
    ? block.items.length > 30 || block.items.some(item => item.length > 500)
    : block.text.length > 5000)) return "Mỗi đoạn tối đa 5.000 ký tự; danh sách tối đa 30 mục, mỗi mục 500 ký tự.";
  return "";
}

