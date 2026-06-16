import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid Mongo object id");

export const createProviderApplicationSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  experienceYears: z.number().int().min(0),
  serviceIds: z.array(objectIdSchema).min(1),
  workingAreas: z.array(z.string().trim().min(1).max(120)).min(1),
});

export const reviewProviderApplicationSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => data.status !== "rejected" || Boolean(data.rejectionReason),
    "Rejection reason is required when rejecting an application",
  );
