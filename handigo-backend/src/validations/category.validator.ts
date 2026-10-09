import { z } from "zod";

const requiredString = z.string().trim().min(1);
const slugSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập đường dẫn")
  .max(120, "Đường dẫn không được vượt quá 120 ký tự")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Đường dẫn chỉ được chứa chữ thường, chữ số và dấu gạch nối",
  );

export const createCategorySchema = z.object({
  name: requiredString.max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  icon: z.string().trim().max(500).nullable().optional(),
  iconColor: z.string().trim()
    .regex(/^#[0-9a-f]{6}$/i, "Màu biểu tượng phải có định dạng #RRGGBB")
    .nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const updateCategorySchema = createCategorySchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  { message: "Vui lòng cung cấp ít nhất một trường dữ liệu" },
);

export const categoryIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Định danh danh mục không hợp lệ"),
});

export const categoryQuerySchema = z.object({
  keyword: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
