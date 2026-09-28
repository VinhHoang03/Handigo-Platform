/** Chính sách điểm thưởng cho khách hàng; không cộng hồi tố đơn cũ. */
export const REWARD_POLICY = {
  amountPerPoint: 10_000,
  validityDays: 30,
  offers: [
    { id: "SAVE10", name: "Giảm 10.000đ", points: 100, discountValue: 10_000, minOrderAmount: 100_000 },
    { id: "SAVE25", name: "Giảm 25.000đ", points: 250, discountValue: 25_000, minOrderAmount: 250_000 },
    { id: "SAVE50", name: "Giảm 50.000đ", points: 500, discountValue: 50_000, minOrderAmount: 500_000 },
  ],
};

export const calculateRewardPoints = (amount: number) =>
  Number.isFinite(amount) ? Math.max(0, Math.floor(amount / REWARD_POLICY.amountPerPoint)) : 0;
