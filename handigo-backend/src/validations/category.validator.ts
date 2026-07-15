import { z } from "zod";

const requiredString = z.string().trim().min(1);
const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(120, "Slug must be at most 120 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers, and hyphens",
  );

export const createCategorySchema = z.object({
  name: requiredString.max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  icon: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const updateCategorySchema = createCategorySchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  { message: "At least one field is required" },
);

export const categoryIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid category id"),
});

export const categoryQuerySchema = z.object({
  keyword: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
