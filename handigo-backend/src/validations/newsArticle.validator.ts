import { z } from "zod";

const textBlock = z.object({
  type: z.enum(["paragraph", "heading", "quote"]),
  text: z.string().trim().min(1, "Nội dung không được để trống").max(5000),
}).strict();

const listBlock = z.object({
  type: z.literal("list"),
  items: z
    .array(z.string().trim().min(1).max(500))
    .min(1, "Danh sách phải có ít nhất một mục")
    .max(30),
}).strict();

const articleFields = {
  title: z.string().trim().min(5).max(200),
  excerpt: z.string().trim().min(10).max(500),
  category: z.string().trim().min(2).max(80),
  coverImage: z.string().trim().url().max(1000),
  authorName: z.string().trim().min(2).max(120),
  content: z.array(z.union([textBlock, listBlock])).min(1).max(100),
  status: z.enum(["draft", "published"]),
  isFeatured: z.boolean().optional(),
};

export const createNewsArticleSchema = z.object(articleFields).strict();

export const updateNewsArticleSchema = z
  .object(articleFields)
  .partial()
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật",
  });
