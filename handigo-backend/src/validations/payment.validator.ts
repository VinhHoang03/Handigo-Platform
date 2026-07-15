import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

export const createPaymentSchema = z.object({
  orderId: objectIdSchema,
  method: z.enum(["PAYOS", "CASH", "WALLET"]),
  paymentType: z.enum(["INSPECTION_DEPOSIT", "FULL", "REMAINING"]).optional(),
  returnUrl: z.string().url("returnUrl không hợp lệ").optional(),
  cancelUrl: z.string().url("cancelUrl không hợp lệ").optional(),
});

export const paymentIdParamSchema = z.object({
  id: objectIdSchema,
});

export const orderIdParamSchema = z.object({
  orderId: objectIdSchema,
});

export const paymentHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  method: z.enum(["payos", "vnpay", "cash", "wallet"]).optional(),
  paymentType: z.enum(["full", "remaining", "inspection_deposit"]).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentHistoryQuery = z.infer<typeof paymentHistoryQuerySchema>;
