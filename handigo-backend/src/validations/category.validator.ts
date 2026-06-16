import { z } from "zod";

const requiredString = z.string().trim().min(1);

export const createCategorySchema = z.object({
  name: requiredString,
  slug: requiredString,
  description: z.string().trim().nullable().optional(),
  icon: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const updateCategorySchema = createCategorySchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  { message: "At least one category field is required" },
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
