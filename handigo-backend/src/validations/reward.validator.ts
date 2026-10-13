import { z } from "zod";

export const rewardPageSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) });
export const redeemRewardSchema = z.object({
  offerId: z.string().trim().min(1).max(40),
  requestId: z.uuid("Mã yêu cầu không hợp lệ."),
}).strict();

export const rewardOfferSchema = z.object({
  id: z.string().trim().regex(/^[A-Z0-9_-]{1,40}$/, "Mã gói chỉ gồm chữ in hoa, số, dấu gạch ngang hoặc gạch dưới."),
  name: z.string().trim().min(1, "Vui lòng nhập tên gói.").max(120),
  points: z.number().int().positive("Điểm đổi phải lớn hơn 0.").max(1_000_000),
  discountType: z.enum(["AMOUNT", "PERCENT"]).default("AMOUNT"),
  discountValue: z.number().positive("Mức giảm phải lớn hơn 0.").max(100_000_000),
  minOrderAmount: z.number().min(0).max(100_000_000),
  maxDiscountAmount: z.number().positive().max(100_000_000).optional(),
  applicableOrderType: z.enum(["fixed_price", "variable_price"]).default("fixed_price"),
  isActive: z.boolean().default(true),
}).strict().superRefine((offer, ctx) => {
  if (offer.discountType === "PERCENT" && offer.discountValue > 100) {
    ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Mức giảm phần trăm không được vượt quá 100%." });
  }
  if (offer.applicableOrderType === "variable_price" && offer.discountType === "PERCENT" && offer.discountValue === 100
    && (offer.maxDiscountAmount == null || offer.maxDiscountAmount > 30_000)) {
    ctx.addIssue({ code: "custom", path: ["maxDiscountAmount"], message: "Gói giảm 100% phí cọc phải giới hạn tối đa 30.000đ." });
  }
});
export type AdminRewardOfferInput = z.infer<typeof rewardOfferSchema>;
