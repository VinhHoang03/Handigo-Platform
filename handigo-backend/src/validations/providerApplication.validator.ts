import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Mã định danh không hợp lệ");

const dateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Ngày không hợp lệ",
  });

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const endOfToday = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

const validateDateRange = (
  payload: { issuedAt?: string; expiresAt?: string },
  ctx: z.RefinementCtx,
) => {
  const issuedAt = payload.issuedAt ? new Date(payload.issuedAt) : undefined;
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : undefined;
  const today = startOfToday();

  if (issuedAt && issuedAt > endOfToday()) {
    ctx.addIssue({
      code: "custom",
      path: ["issuedAt"],
      message: "Ngày cấp không được sau ngày hiện tại",
    });
  }
  if (expiresAt && expiresAt < today) {
    ctx.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Tài liệu đã hết hạn",
    });
  }
  if (issuedAt && expiresAt && expiresAt <= issuedAt) {
    ctx.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Ngày hết hạn phải sau ngày cấp",
    });
  }
};

const validateDateOfBirth = (
  payload: { dateOfBirth?: string },
  ctx: z.RefinementCtx,
) => {
  if (payload.dateOfBirth && new Date(payload.dateOfBirth) > endOfToday()) {
    ctx.addIssue({
      code: "custom",
      path: ["dateOfBirth"],
      message: "Ngày sinh không được sau ngày hiện tại",
    });
  }
};

const optionalText = (max: number) => z.string().trim().max(max).optional();
const imageUrlSchema = z.string().trim().url().max(2000);

const workingAreaSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((area) => {
    const separatorIndex = area.lastIndexOf(",");
    return separatorIndex > 0 && Boolean(area.slice(separatorIndex + 1).trim());
  }, "Khu vực hoạt động phải có định dạng 'Phường/Xã, Tỉnh/Thành phố'");

export const validateWorkingAreasSameProvince = (
  areas: string[],
  ctx: z.RefinementCtx,
) => {
  const provinces = areas.map((area) =>
    area.slice(area.lastIndexOf(",") + 1).trim().normalize("NFC").toLocaleLowerCase("vi"),
  );

  if (new Set(provinces).size > 1) {
    ctx.addIssue({
      code: "custom",
      message: "Tất cả khu vực hoạt động phải thuộc cùng một tỉnh/thành phố",
    });
  }
};

export const providerWorkingAreasSchema = z
  .array(workingAreaSchema)
  .min(1)
  .superRefine(validateWorkingAreasSameProvince);

const draftWorkingAreasSchema = z
  .array(workingAreaSchema)
  .superRefine(validateWorkingAreasSameProvince);

const identityFields = {
  type: z.enum(["cccd", "passport"]),
  documentNumber: z.string().trim().max(50),
  fullName: z.string().trim().max(120),
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
};

const identityDocumentSchema = z
  .object({
    ...identityFields,
    documentNumber: identityFields.documentNumber.min(1),
    fullName: identityFields.fullName.min(1),
  })
  .superRefine((payload, ctx) => {
    validateDateRange(payload, ctx);
    validateDateOfBirth(payload, ctx);

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

const certificateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    certificateNumber: optionalText(100),
    issuer: optionalText(200),
    issuedAt: dateStringSchema.optional(),
    expiresAt: dateStringSchema.optional(),
    imageUrls: z.array(imageUrlSchema).min(1),
    description: optionalText(2000),
  })
  .superRefine(validateDateRange);

const draftIdentityDocumentSchema = z.object({
  ...identityFields,
  type: identityFields.type.default("cccd"),
  documentNumber: identityFields.documentNumber.optional(),
  fullName: identityFields.fullName.optional(),
});

const draftCertificateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  certificateNumber: optionalText(100),
  issuer: optionalText(200),
  issuedAt: dateStringSchema.optional(),
  expiresAt: dateStringSchema.optional(),
  imageUrls: z.array(imageUrlSchema).default([]),
});

const initialProviderApplicationSchema = z.object({
  applicationType: z.literal("initial").default("initial"),
  description: z.string().trim().min(1).max(2000),
  experienceYears: z.number().int().min(0),
  serviceIds: z.array(objectIdSchema).min(1),
  workingAreas: providerWorkingAreasSchema,
  identityDocument: identityDocumentSchema,
  certificates: z.array(certificateSchema).default([]),
});

const serviceAdditionApplicationSchema = z.object({
  applicationType: z.literal("service_addition"),
  description: z.string().trim().max(2000).optional().default(""),
  experienceYears: z.number().int().min(0).optional().default(0),
  serviceIds: z.array(objectIdSchema).min(1),
  certificates: z.array(certificateSchema).min(1),
});

export const createProviderApplicationSchema = z.union([
  initialProviderApplicationSchema,
  serviceAdditionApplicationSchema,
]);

export const saveProviderApplicationDraftSchema = z.object({
  description: z.string().trim().max(2000).optional(),
  experienceYears: z.number().int().min(0).optional(),
  serviceIds: z.array(objectIdSchema).optional(),
  workingAreas: draftWorkingAreasSchema.optional(),
  identityDocument: draftIdentityDocumentSchema.optional(),
  certificates: z.array(draftCertificateSchema).optional(),
});

export const reviewProviderApplicationSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().trim().max(200).optional(),
    rejectionNotes: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status !== "rejected") return;
    if (!data.rejectionReason) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Lý do từ chối là bắt buộc",
      });
    }
    if (!data.rejectionNotes) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionNotes"],
        message: "Ghi chú chi tiết là bắt buộc",
      });
    }
  });

export const providerApplicationIdParamSchema = z.object({
  id: objectIdSchema,
});

export const providerApplicationListQuerySchema = z.object({
  status: z
    .enum(["draft", "pending", "resubmitted", "approved", "rejected"])
    .optional(),
  keyword: z.string().trim().max(100).optional(),
  categoryId: objectIdSchema.optional(),
  applicationType: z.enum(["initial", "service_addition"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
