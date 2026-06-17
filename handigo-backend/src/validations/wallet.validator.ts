import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

export const walletTransactionTypeSchema = z.enum([
  "deposit",
  "payment",
  "refund",
  "provider_earning",
  "platform_fee",
  "withdraw",
  "withdraw_rejected",
  "adjustment",
]);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const walletTransactionQuerySchema = paginationQuerySchema.extend({
  type: walletTransactionTypeSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const adminWalletListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  sortByBalance: z.enum(["asc", "desc"]).default("desc"),
});

export const providerIdParamSchema = z.object({
  providerId: objectIdSchema,
});

export const walletDepositOrderCodeParamSchema = z.object({
  orderCode: z.string().trim().regex(/^\d+$/, "orderCode khong hop le"),
});

export const adminWalletAdjustmentSchema = z.object({
  amount: z.coerce.number().positive("Số tiền phải lớn hơn 0"),
  direction: z.enum(["in", "out"]),
  reason: z.string().trim().min(1, "Lý do điều chỉnh là bắt buộc"),
});

export const walletDepositSchema = z.object({
  amount: z.coerce.number().int("So tien phai la so nguyen").positive("So tien phai lon hon 0"),
  returnUrl: z.string().url("returnUrl khong hop le").optional(),
  cancelUrl: z.string().url("cancelUrl khong hop le").optional(),
});

export type WalletTransactionQuery = z.infer<typeof walletTransactionQuerySchema>;
export type AdminWalletListQuery = z.infer<typeof adminWalletListQuerySchema>;
export type AdminWalletAdjustmentInput = z.infer<typeof adminWalletAdjustmentSchema>;
export type WalletDepositInput = z.infer<typeof walletDepositSchema>;
