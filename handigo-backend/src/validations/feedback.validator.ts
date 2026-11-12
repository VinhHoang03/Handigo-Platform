import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Định danh MongoDB không hợp lệ");

const imageUrlSchema = z.string().trim().url("Image must be a valid URL");
const ratingSchema = z.number().min(1).max(5).multipleOf(0.5);

const booleanQuerySchema = z.enum(["true", "false"]).transform(
  (value) => value === "true",
);

export const feedbackListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  rating: z.coerce.number().min(1).max(5).multipleOf(0.5).optional(),
  hasImages: booleanQuerySchema.optional(),
  replied: booleanQuerySchema.optional(),
  keyword: z.string().trim().max(100).optional(),
  isVisible: booleanQuerySchema.optional(),
});

export const adminFeedbackListQuerySchema = feedbackListQuerySchema.extend({
  ratingBelow: z.coerce.number().min(1).max(5).optional(),
  categoryId: objectIdSchema.optional(),
  sort: z.enum(["attention", "newest"]).optional(),
});

export const serviceFeedbackQuerySchema = feedbackListQuerySchema.extend({
  optionId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Mã gói dịch vụ không hợp lệ").optional(),
  sort: z.enum(["newest", "rating"]).default("newest"),
  positiveOnly: booleanQuerySchema.optional(),
});

export const createFeedbackSchema = z.object({
  orderId: objectIdSchema,
  rating: ratingSchema,
  comment: z.string().trim().max(1000).nullable().optional(),
  images: z.array(imageUrlSchema).max(5).optional(),
});

export const updateFeedbackSchema = z
  .object({
    rating: ratingSchema.optional(),
    comment: z.string().trim().max(1000).nullable().optional(),
    images: z.array(imageUrlSchema).max(5).optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "Vui lòng cung cấp ít nhất một trường dữ liệu",
  );

export const visibilitySchema = z.object({
  isVisible: z.boolean(),
  expectedVersion: z.iso.datetime({ message: "Phiên bản đánh giá không hợp lệ." }).optional(),
});

export const providerReplySchema = z.object({
  content: z.string().trim().min(1).max(1000),
  images: z.array(imageUrlSchema).max(5).optional(),
});

export const moderationListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  resourceId: objectIdSchema.optional(),
  kind: z.enum(["comment", "reply"]).optional(),
});

export const moderationIdSchema = z.object({ id: objectIdSchema });
export const moderationReviewSchema = z.object({ status: z.enum(["approved", "rejected"]) }).strict();

export const moderationReportQuerySchema = z.object({
  days: z.enum(["7", "30", "90", "all"]).default("30"),
  view: z.enum(["attention", "blocked", "all"]).default("attention"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ModerationReportQuery = z.infer<typeof moderationReportQuerySchema>;
