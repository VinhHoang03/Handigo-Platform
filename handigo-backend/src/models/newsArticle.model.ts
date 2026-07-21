import { Document, Schema, Types, model } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export type NewsArticleStatus = "draft" | "published";
export type NewsContentBlockType = "paragraph" | "heading" | "quote" | "list";

export interface INewsContentBlock {
  type: NewsContentBlockType;
  text?: string;
  items?: string[];
}

export interface INewsArticle extends Document, IBaseDocument {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImage: string;
  authorName: string;
  content: INewsContentBlock[];
  status: NewsArticleStatus;
  isFeatured: boolean;
  publishedAt?: Date | null;
  createdBy: Types.ObjectId;
}

const NewsContentBlockSchema = new Schema<INewsContentBlock>(
  {
    type: {
      type: String,
      enum: ["paragraph", "heading", "quote", "list"],
      required: true,
    },
    text: { type: String, trim: true, default: undefined },
    items: { type: [String], default: undefined },
  },
  { _id: false },
);

const NewsArticleSchema = new Schema<INewsArticle>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    coverImage: { type: String, required: true, trim: true },
    authorName: { type: String, required: true, trim: true },
    content: {
      type: [NewsContentBlockSchema],
      required: true,
      validate: {
        validator: (blocks: INewsContentBlock[]) => blocks.length > 0,
        message: "Bài viết phải có ít nhất một khối nội dung",
      },
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    isFeatured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ...baseFields,
  },
  { timestamps: true },
);

NewsArticleSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
NewsArticleSchema.index({ status: 1, isDeleted: 1, isFeatured: -1, publishedAt: -1 });
NewsArticleSchema.index({ category: 1, status: 1, isDeleted: 1 });

export const NewsArticle = model<INewsArticle>(
  "NewsArticle",
  NewsArticleSchema,
  "news_articles",
);
