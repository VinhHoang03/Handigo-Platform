import { QueryFilter, Types } from "mongoose";
import {
  INewsArticle,
  NewsArticle,
  NewsArticleStatus,
} from "../models/newsArticle.model";
import { AppError } from "../utils/appError";

interface ArticlePayload {
  title?: string;
  excerpt?: string;
  category?: string;
  coverImage?: string;
  authorName?: string;
  content?: Array<
    | { type: "paragraph" | "heading" | "quote"; text: string }
    | { type: "list"; items: string[] }
  >;
  status?: NewsArticleStatus;
  isFeatured?: boolean;
}

interface ArticleQuery {
  search?: string;
  category?: string;
  status?: NewsArticleStatus;
}

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatArticle = (article: INewsArticle) => ({
  id: article._id.toString(),
  slug: article.slug,
  title: article.title,
  excerpt: article.excerpt,
  category: article.category,
  coverImage: article.coverImage,
  authorName: article.authorName,
  content: article.content,
  status: article.status,
  isFeatured: article.isFeatured,
  publishedAt: article.publishedAt,
  createdAt: article.createdAt,
  updatedAt: article.updatedAt,
});

const ensureValidId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Mã bài viết không hợp lệ", 400);
  }
};

const createUniqueSlug = async (title: string, excludeId?: string) => {
  const baseSlug = slugify(title);
  if (!baseSlug) throw new AppError("Không thể tạo đường dẫn bài viết", 400);

  let slug = baseSlug;
  let suffix = 1;
  while (
    await NewsArticle.exists({
      slug,
      isDeleted: false,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
};

export const listPublishedArticles = async (query: ArticleQuery) => {
  const filter: QueryFilter<INewsArticle> = {
    status: "published",
    isDeleted: false,
  };
  if (query.category?.trim()) filter.category = query.category.trim();
  if (query.search?.trim()) {
    const search = escapeRegex(query.search.trim());
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
    ];
  }

  const articles = await NewsArticle.find(filter)
    .sort({ isFeatured: -1, publishedAt: -1, createdAt: -1 })
    .limit(100);
  return articles.map(formatArticle);
};

export const getPublishedArticle = async (slug: string) => {
  const article = await NewsArticle.findOne({
    slug,
    status: "published",
    isDeleted: false,
  });
  if (!article) throw new AppError("Không tìm thấy bài viết", 404);
  return formatArticle(article);
};

export const listAdminArticles = async (query: ArticleQuery) => {
  const filter: QueryFilter<INewsArticle> = { isDeleted: false };
  if (query.status) filter.status = query.status;
  if (query.category?.trim()) filter.category = query.category.trim();
  if (query.search?.trim()) {
    const search = escapeRegex(query.search.trim());
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
    ];
  }

  const articles = await NewsArticle.find(filter).sort({ updatedAt: -1 });
  return articles.map(formatArticle);
};

export const createArticle = async (
  createdBy: string,
  payload: ArticlePayload,
) => {
  ensureValidId(createdBy);
  const status = payload.status || "draft";
  const article = await NewsArticle.create({
    ...payload,
    slug: await createUniqueSlug(payload.title || ""),
    status,
    publishedAt: status === "published" ? new Date() : null,
    createdBy: new Types.ObjectId(createdBy),
  });
  return formatArticle(article);
};

export const updateArticle = async (id: string, payload: ArticlePayload) => {
  ensureValidId(id);
  const article = await NewsArticle.findOne({ _id: id, isDeleted: false });
  if (!article) throw new AppError("Không tìm thấy bài viết", 404);

  if (payload.title && payload.title !== article.title) {
    article.slug = await createUniqueSlug(payload.title, id);
  }
  Object.assign(article, payload);
  if (payload.status === "published" && !article.publishedAt) {
    article.publishedAt = new Date();
  }
  if (payload.status === "draft") article.publishedAt = null;

  await article.save();
  return formatArticle(article);
};

export const deleteArticle = async (id: string) => {
  ensureValidId(id);
  const article = await NewsArticle.findOne({ _id: id, isDeleted: false });
  if (!article) throw new AppError("Không tìm thấy bài viết", 404);
  article.isDeleted = true;
  article.deletedAt = new Date();
  await article.save();
};
