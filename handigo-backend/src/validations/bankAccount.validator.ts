import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

export const bankAccountIdParamSchema = z.object({
  id: objectIdSchema,
});

export const createBankAccountSchema = z.object({
  bankName: z.string().trim().min(1, "Tên ngân hàng là bắt buộc").max(100),
  bankCode: z.string().trim().min(1, "Mã ngân hàng là bắt buộc").max(30),
  accountNumber: z
    .string()
    .trim()
    .min(4, "Số tài khoản phải có ít nhất 4 ký tự")
    .max(50),
  accountHolderName: z
    .string()
    .trim()
    .min(2, "Tên chủ tài khoản phải có ít nhất 2 ký tự")
    .max(100),
  isDefault: z.boolean().optional(),
});

export const updateBankAccountSchema = z.object({
  bankName: z.string().trim().min(1).max(100).optional(),
  bankCode: z.string().trim().min(1).max(30).optional(),
  accountNumber: z.string().trim().min(4).max(50).optional(),
  accountHolderName: z.string().trim().min(2).max(100).optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
