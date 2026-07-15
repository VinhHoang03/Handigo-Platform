import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

export const withdrawalIdParamSchema = z.object({
  id: objectIdSchema,
});

export const createWithdrawalSchema = z.object({
  amount: z.coerce.number().positive("Số tiền rút phải lớn hơn 0"),
  bankAccountId: objectIdSchema.optional(),
});

export const withdrawalReviewSchema = z.object({
  adminNote: z.string().trim().max(500, "Ghi chú không được vượt quá 500 ký tự").optional(),
});

export const withdrawalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
export type WithdrawalReviewInput = z.infer<typeof withdrawalReviewSchema>;
export type WithdrawalListQuery = z.infer<typeof withdrawalListQuerySchema>;
