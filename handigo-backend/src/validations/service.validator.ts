import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập đường dẫn")
  .max(120, "Đường dẫn không được vượt quá 120 ký tự")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Đường dẫn chỉ được chứa chữ thường, chữ số và dấu gạch nối",
  );

const serviceImageUrl = z.string().trim().url().max(2000).refine(value => /^https?:\/\//i.test(value), "Ảnh phải dùng đường dẫn HTTP hoặc HTTPS");

const serviceFields = {
  optionGroups: z.array(z.object({
    _id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Mã nhóm không hợp lệ").optional(),
    name: z.string().trim().min(1, "Tên nhóm là bắt buộc").max(120),
    selectionMode: z.enum(["single", "multiple"]),
    isRequired: z.boolean(),
    sortOrder: z.number().int().min(0).default(0),
  }).strict()).max(50).optional(),
  categoryId: z.string().trim().min(1, "Danh mục là bắt buộc"),
  name: z.string().trim().min(1, "Tên dịch vụ là bắt buộc").max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  processSteps: z.array(z.object({
    title: z.string().trim().min(1, "Tiêu đề bước là bắt buộc").max(120, "Tiêu đề bước tối đa 120 ký tự"),
    description: z.string().trim().min(1, "Mô tả bước là bắt buộc").max(2000, "Mô tả bước tối đa 2000 ký tự"),
  })).max(20, "Quy trình dịch vụ chỉ được có tối đa 20 bước").optional(),
  serviceType: z.enum(["fixed_price", "variable_price"]),
  fixedPrice: z.number().min(0).nullable().optional(),
  depositAmount: z.number().min(0).nullable().optional(),
  image: z.string().trim().url("Ảnh dịch vụ phải là một đường dẫn hợp lệ").max(2000).nullable().optional(),
  coverImage: serviceImageUrl.nullable().optional(),
  galleryImages: z.array(serviceImageUrl).max(8, "Thư viện tối đa 8 ảnh").refine(images => new Set(images).size === images.length, "Ảnh thư viện không được trùng nhau").optional(),
  requiresOptionSelection: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

const validateActivePricing = (
  data: Partial<z.infer<z.ZodObject<typeof serviceFields>>>,
  context: z.RefinementCtx,
) => {
  if (data.isActive === false) return;

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
