import { z } from "zod";
import { personNameSchema, vietnamesePhoneSchema } from "./user.validator";
import { providerWorkingAreasSchema } from "./providerApplication.validator";

const dateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Ngày không hợp lệ",
  });

const optionalText = (max: number) =>
  z.string().trim().max(max).optional();

const imageUrlSchema = z.string().trim().url().max(2000);

const endOfToday = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const validateDateRange = (
  payload: { issuedAt?: string; expiresAt?: string },
  context: z.RefinementCtx,
) => {
  const issuedAt = payload.issuedAt ? new Date(payload.issuedAt) : undefined;
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : undefined;

  if (issuedAt && issuedAt > endOfToday()) {
    context.addIssue({
      code: "custom",
      path: ["issuedAt"],
      message: "Ngày cấp không được sau ngày hiện tại",
    });
  }
  if (expiresAt && expiresAt < startOfToday()) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Tài liệu đã hết hạn",
    });
  }
  if (issuedAt && expiresAt && expiresAt <= issuedAt) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Ngày hết hạn phải sau ngày cấp",
    });
  }
};

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
  workingAreas: providerWorkingAreasSchema.optional(),
}).superRefine((payload, context) => {
  if (payload.birthday && new Date(payload.birthday) > endOfToday()) {
    context.addIssue({
      code: "custom",
      path: ["birthday"],
      message: "Ngày sinh không được sau ngày hiện tại",
    });
  }
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
    validateDateRange(payload, ctx);
    if (payload.dateOfBirth && new Date(payload.dateOfBirth) > endOfToday()) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Ngày sinh không được sau ngày hiện tại",
      });
    }

    if (payload.type === "cccd" && !payload.frontImageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["frontImageUrl"],
        message: "Ảnh mặt trước CCCD là bắt buộc",
      });
    }

    if (payload.type === "passport" && !payload.passportImageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["passportImageUrl"],
        message: "Ảnh hộ chiếu là bắt buộc",
      });
    }
  });

const certificateFields = {
  title: z.string().trim().min(1).max(200),
  certificateNumber: optionalText(100),
  issuer: optionalText(200),
  issuedAt: dateStringSchema.optional(),
  expiresAt: dateStringSchema.optional(),
  imageUrls: z.array(imageUrlSchema).max(10).default([]),
  description: optionalText(2000),
  isPublic: z.boolean().optional(),
};

export const createCertificateSchema = z
  .object(certificateFields)
  .superRefine(validateDateRange);

export const updateCertificateSchema = z
  .object(certificateFields)
  .partial()
  .refine(
    (payload) => Object.keys(payload).length > 0,
    "Cần cung cấp ít nhất một trường để cập nhật",
  )
  .superRefine(validateDateRange);

export type UpdateProviderProfilePayload = z.infer<
  typeof updateProviderProfileSchema
>;
export type SubmitIdentityPayload = z.infer<typeof submitIdentitySchema>;
export type CreateCertificatePayload = z.infer<typeof createCertificateSchema>;
export type UpdateCertificatePayload = z.infer<typeof updateCertificateSchema>;
