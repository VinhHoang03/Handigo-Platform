import { z } from "zod";

export const rewardPageSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) });
export const redeemRewardSchema = z.object({
  offerId: z.string().trim().min(1).max(40),
  requestId: z.uuid("Mã yêu cầu không hợp lệ."),
}).strict();
