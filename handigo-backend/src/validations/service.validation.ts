import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(120, "Slug must be at most 120 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers, and hyphens",
  );

const serviceFields = {
  categoryId: z.string().trim().min(1, "Category is required"),
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  serviceType: z.enum(["fixed_price", "variable_price"]),
  fixedPrice: z.number().nonnegative().nullable().optional(),
  depositAmount: z.number().nonnegative().nullable().optional(),
  image: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
};

export const createServiceSchema = z
  .object(serviceFields)
  .superRefine((data, ctx) => {
    if (data.serviceType === "fixed_price" && data.fixedPrice == null) {
      ctx.addIssue({
        code: "custom",
        path: ["fixedPrice"],
        message: "Fixed price is required for fixed-price services",
      });
    }
  });

export const updateServiceSchema = z
  .object(serviceFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
