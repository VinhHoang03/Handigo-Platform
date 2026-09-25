import api from "@/api/client";
import { unwrap } from "@/api/response";

export interface RewardOffer {
  id: string; name: string; points: number; discountValue: number; minOrderAmount: number;
}
export interface RewardOverview {
  balance: number; totalEarned: number; totalRedeemed: number;
  policy: { amountPerPoint: number; validityDays: number; offers: RewardOffer[] };
}
export interface RewardVoucher {
  _id: string; code: string; name: string; discountValue: number; minOrderAmount: number;
  startAt: string; endAt: string; usedCount: number; isActive: boolean; status: string;
  reservedOrderId: string | null;
}
export interface RewardEntry {
  _id: string; kind: "EARN" | "REDEEM"; points: number; balanceAfter: number; description: string; createdAt: string;
}
export interface RewardPage<T> { items: T[]; total: number; page: number; totalPages: number }
export const rewardsApi = {
  overview: async () => unwrap<RewardOverview>(await api.get("/rewards/me")),
  vouchers: async (page = 1) => unwrap<RewardPage<RewardVoucher>>(await api.get("/rewards/vouchers", { params: { page } })),
  history: async (page = 1) => unwrap<RewardPage<RewardEntry>>(await api.get("/rewards/history", { params: { page } })),
  redeem: async (offerId: string, requestId: string) =>
    unwrap<RewardVoucher>(await api.post("/rewards/redeem", { offerId, requestId })),
};
