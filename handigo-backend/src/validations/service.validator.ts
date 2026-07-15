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
  categoryId: z.string().trim().min(1, "Danh mục là bắt buộc"),
  name: z.string().trim().min(1, "Tên dịch vụ là bắt buộc").max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  serviceType: z.enum(["fixed_price", "variable_price"]),
  fixedPrice: z.number().min(0).nullable().optional(),
  depositAmount: z.number().min(0).nullable().optional(),
  image: z.string().trim().url("Ảnh dịch vụ phải là một đường dẫn hợp lệ").max(2000).nullable().optional(),
  requiresOptionSelection: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

const validateActivePricing = (
  data: Partial<z.infer<z.ZodObject<typeof serviceFields>>>,
  context: z.RefinementCtx,
) => {
  if (data.isActive === false) return;

  if (data.serviceType === "fixed_price" && (!data.fixedPrice || data.fixedPrice <= 0)) {
    context.addIssue({
      code: "custom",
      path: ["fixedPrice"],
      message: "Dịch vụ giá cố định đang hoạt động phải có giá lớn hơn 0",
    });
  }

  if (data.serviceType === "variable_price" && data.depositAmount == null) {
    context.addIssue({
      code: "custom",
      path: ["depositAmount"],
      message: "Dịch vụ giá linh hoạt đang hoạt động phải có tiền đặt cọc",
    });
  }
};

export const createServiceSchema = z.object(serviceFields).superRefine(validateActivePricing);

export const updateServiceSchema = z
  .object(serviceFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật",
  });
