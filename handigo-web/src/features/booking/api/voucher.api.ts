import api from "@/api/client";
import { unwrap } from "@/api/response";
import type { AppliedVoucherResult, AvailableVoucher } from "../types/voucher.types";

export const bookingVoucherApi = {
  available: async (orderId?: string) =>
    unwrap<AvailableVoucher[]>(
      await api.get("/vouchers/available", { params: orderId ? { orderId } : undefined }),
    ),
  apply: async (orderId: string, code: string) =>
    unwrap<AppliedVoucherResult>(await api.post("/vouchers/apply", { orderId, code })),
  remove: async (orderId: string) =>
    unwrap<AppliedVoucherResult>(await api.post("/vouchers/remove", { orderId })),
};
