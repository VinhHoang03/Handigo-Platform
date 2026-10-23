/** Chính sách điểm thưởng cho khách hàng; không cộng hồi tố đơn cũ. */
export interface RewardOffer {
  id: string;
  name: string;
  points: number;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  discountType?: "AMOUNT" | "PERCENT";
  applicableOrderType?: "fixed_price" | "variable_price";
}

export const REWARD_POLICY = {
  amountPerPoint: 10_000,
  validityDays: 30,
  offers: [
    { id: "SAVE10", name: "Giảm 10.000đ", points: 100, discountValue: 10_000, minOrderAmount: 100_000 },
    { id: "SAVE25", name: "Giảm 25.000đ", points: 250, discountValue: 25_000, minOrderAmount: 250_000 },
    { id: "DEPOSIT50", name: "Giảm 50% phí cọc", points: 300, discountType: "PERCENT", discountValue: 50, minOrderAmount: 0, applicableOrderType: "variable_price" },
    { id: "SAVE50", name: "Giảm 50.000đ", points: 500, discountValue: 50_000, minOrderAmount: 500_000 },
    { id: "DEPOSIT100", name: "Giảm 100% phí cọc", points: 500, discountType: "PERCENT", discountValue: 100, maxDiscountAmount: 30_000, minOrderAmount: 0, applicableOrderType: "variable_price" },
  ] as RewardOffer[],
};

export const calculateRewardPoints = (amount: number, amountPerPoint = REWARD_POLICY.amountPerPoint) =>
  Number.isFinite(amount) && Number.isFinite(amountPerPoint) && amountPerPoint > 0
    ? Math.max(0, Math.floor(amount / amountPerPoint)) : 0;
