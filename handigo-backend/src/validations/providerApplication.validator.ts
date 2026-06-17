import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid Mongo object id");

const dateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date",
  });

const optionalText = (max: number) => z.string().trim().max(max).optional();
const imageUrlSchema = z.string().trim().url().max(2000);

const identityDocumentSchema = z
  .object({
    type: z.enum(["cccd", "passport"]),
    documentNumber: z.string().trim().min(1).max(50),
    fullName: z.string().trim().min(1).max(120),
    issuedPlace: optionalText(200),
    issuedAt: dateStringSchema.optional(),
    expiresAt: dateStringSchema.optional(),
    frontImageUrl: imageUrlSchema.optional(),
    backImageUrl: imageUrlSchema.optional(),
    passportImageUrl: imageUrlSchema.optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.type === "cccd" && !payload.frontImageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["frontImageUrl"],
        message: "frontImageUrl is required for CCCD",
      });
    }

    if (payload.type === "passport" && !payload.passportImageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["passportImageUrl"],
        message: "passportImageUrl is required for passport",
      });
    }
  });

const certificateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  issuer: optionalText(200),
  issuedAt: dateStringSchema.optional(),
  expiresAt: dateStringSchema.optional(),
  imageUrls: z.array(imageUrlSchema).min(1),
});

export const createProviderApplicationSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  experienceYears: z.number().int().min(0),
  serviceIds: z.array(objectIdSchema).min(1),
  workingAreas: z.array(z.string().trim().min(1).max(120)).min(1),
  identityDocument: identityDocumentSchema,
  certificates: z.array(certificateSchema).default([]),
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
