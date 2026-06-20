import { z } from "zod";
import { personNameSchema, vietnamesePhoneSchema } from "./user.validator";

const dateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date",
  });

const optionalText = (max: number) =>
  z.string().trim().max(max).optional();

const imageUrlSchema = z.string().trim().url().max(2000);

export const providerServiceAreaSchema = z.object({
  province: optionalText(120),
  ward: optionalText(120),
});

export const updateProviderProfileSchema = z.object({
  fullName: personNameSchema.optional(),
  phone: vietnamesePhoneSchema.optional(),
  avatar: z.string().trim().url().max(2000).nullable().optional(),
  birthday: dateStringSchema.nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  description: optionalText(2000),
  bio: optionalText(2000),
  mainServiceText: optionalText(200),
  serviceArea: providerServiceAreaSchema.optional(),
});

export const submitIdentitySchema = z
  .object({
    type: z.enum(["cccd", "passport"]),
    documentNumber: optionalText(50),
    numberLast4: z.string().trim().regex(/^\d{4}$/).optional(),
    fullName: optionalText(120),
    issuedPlace: optionalText(200),
    issuedAt: dateStringSchema.optional(),
    expiresAt: dateStringSchema.optional(),
    dateOfBirth: dateStringSchema.optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    nationality: optionalText(120),
    placeOfOrigin: optionalText(300),
    placeOfResidence: optionalText(300),
    frontImageUrl: imageUrlSchema.optional(),
    backImageUrl: imageUrlSchema.optional(),
    passportImageUrl: imageUrlSchema.optional(),
    selfieImageUrl: imageUrlSchema.optional(),
    consentAccepted: z.literal(true),
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

export const createCertificateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  certificateNumber: optionalText(100),
  issuer: optionalText(200),
  issuedAt: dateStringSchema.optional(),
  expiresAt: dateStringSchema.optional(),
  imageUrls: z.array(imageUrlSchema).default([]),
  description: optionalText(2000),
});

export const updateCertificateSchema = createCertificateSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "At least one field is required",
);

export type UpdateProviderProfilePayload = z.infer<
  typeof updateProviderProfileSchema
>;
export type SubmitIdentityPayload = z.infer<typeof submitIdentitySchema>;
export type CreateCertificatePayload = z.infer<typeof createCertificateSchema>;
export type UpdateCertificatePayload = z.infer<typeof updateCertificateSchema>;
