import api from "@/api/client";
import { unwrap } from "@/api/response";

export type NewsContentBlock =
  | { type: "paragraph" | "heading" | "quote"; text: string }
  | { type: "list"; items: string[] };

export interface NewsArticleRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImage: string;
  authorName: string;
  content: NewsContentBlock[];
  status: "draft" | "published";
  isFeatured: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsArticlePayload {
  title: string;
  excerpt: string;
  category: string;
  coverImage: string;
  authorName: string;
  content: NewsContentBlock[];
  status: "draft" | "published";
  isFeatured: boolean;
}

export const newsApi = {
  listPublished: async () =>
    unwrap<NewsArticleRecord[]>(await api.get("/news")),
  getPublished: async (slug: string) =>
    unwrap<NewsArticleRecord>(await api.get(`/news/${slug}`)),
  listAdmin: async () =>
    unwrap<NewsArticleRecord[]>(await api.get("/news/admin/list")),
  create: async (payload: NewsArticlePayload) =>
    unwrap<NewsArticleRecord>(await api.post("/news", payload)),
  update: async (id: string, payload: Partial<NewsArticlePayload>) =>
    unwrap<NewsArticleRecord>(await api.put(`/news/${id}`, payload)),
  remove: async (id: string) => unwrap<null>(await api.delete(`/news/${id}`)),
  uploadCover: async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return unwrap<{ url: string }>(
      await api.post("/admin/assets/images", form, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  },
};
