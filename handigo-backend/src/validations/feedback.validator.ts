import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid Mongo object id");

const imageUrlSchema = z.string().trim().url("Image must be a valid URL");

const booleanQuerySchema = z.enum(["true", "false"]).transform(
  (value) => value === "true",
);

export const feedbackListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  hasImages: booleanQuerySchema.optional(),
  replied: booleanQuerySchema.optional(),
  keyword: z.string().trim().max(100).optional(),
  isVisible: booleanQuerySchema.optional(),
});

export const createFeedbackSchema = z.object({
  orderId: objectIdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullable().optional(),
  images: z.array(imageUrlSchema).max(5).optional(),
});

export const updateFeedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(1000).nullable().optional(),
    images: z.array(imageUrlSchema).max(5).optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one field is required",
  );

export const visibilitySchema = z.object({
  isVisible: z.boolean(),
});

export const providerReplySchema = z.object({
  content: z.string().trim().min(1).max(1000),
  images: z.array(imageUrlSchema).max(5).optional(),
});
