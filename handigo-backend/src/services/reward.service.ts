import mongoose, { ClientSession, Types } from "mongoose";
import { randomUUID } from "crypto";
import { RewardAccount, RewardTransaction } from "../models/reward.model";
import { Promotion } from "../models/promotion.model";
import { IOrder, Order } from "../models/order.model";
import { REWARD_POLICY, calculateRewardPoints } from "../configs/rewards";
import { AppError } from "../utils/appError";

export const earnOrderRewards = async (order: IOrder, session: ClientSession) => {
  // Chỉ tích điểm trên đơn giá cố định đã thanh toán đủ; không tính báo giá ngoài nền tảng.
  if (order.status !== "completed" || order.paymentStatus !== "paid" || order.inspectionRequired) return;
  const points = calculateRewardPoints(order.pricing.totalPaidAmount);
  const key = `earn:${order._id}`;
  if (!points || await RewardTransaction.exists({ _id: key }).session(session)) return;
  const account = await RewardAccount.findOneAndUpdate(
    { _id: order.customerId },
    { $inc: { balance: points, totalEarned: points }, $setOnInsert: { totalRedeemed: 0 } },
    { session, upsert: true, new: true, runValidators: true },
  );
  await RewardTransaction.create([{
    _id: key, userId: order.customerId, kind: "EARN", points, balanceAfter: account.balance,
    orderId: order._id, description: `Hoàn thành đơn ${order.orderCode}`,
  }], { session });
};

export const getRewardOverview = async (userId: string) => {
  const account = await RewardAccount.findById(userId).lean();
  return {
    balance: account?.balance ?? 0, totalEarned: account?.totalEarned ?? 0,
    totalRedeemed: account?.totalRedeemed ?? 0, policy: REWARD_POLICY,
  };
};

export const getRewardHistory = async (userId: string, page: number) => {
  const filter = { userId: new Types.ObjectId(userId) };
  const [items, total] = await Promise.all([
    RewardTransaction.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 12).limit(12).lean(),
    RewardTransaction.countDocuments(filter),
  ]);
  return { items, total, page, totalPages: Math.ceil(total / 12) };
};

export const getMyRewardVouchers = async (userId: string, page: number) => {
  const filter = { ownerId: new Types.ObjectId(userId), isDeleted: false };
  const [items, total] = await Promise.all([
    Promotion.find(filter).select("code name discountValue minOrderAmount startAt endAt usedCount isActive status reservedOrderId")
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 12).limit(12).lean(),
    Promotion.countDocuments(filter),
  ]);
  const reservations = await Order.find({
    _id: { $in: items.flatMap((item) => item.reservedOrderId ? [item.reservedOrderId] : []) },
    customerId: userId, isDeleted: false, status: { $ne: "cancelled" },
  }).select("_id voucherSnapshot.voucherId").lean();
  const activeReservations = new Set(reservations.map((order) => `${order._id}:${order.voucherSnapshot?.voucherId}`));
  return {
    items: items.map((item) => ({ ...item, reservedOrderId:
      activeReservations.has(`${item.reservedOrderId}:${item._id}`) ? item.reservedOrderId : null })),
    total, page, totalPages: Math.ceil(total / 12),
  };
};

export const redeemReward = async (userId: string, offerId: string, requestId: string) => {
  const offer = REWARD_POLICY.offers.find((item) => item.id === offerId);
  if (!offer) throw new AppError("Ưu đãi đổi điểm không tồn tại.", 404);
  const key = `redeem:${userId}:${requestId}`;
  return mongoose.connection.transaction(async (session) => {
    const previous = await RewardTransaction.findById(key).session(session);
    if (previous) {
      if (previous.offerId !== offerId) throw new AppError("Yêu cầu này đã được dùng cho ưu đãi khác.", 409);
      return Promotion.findById(previous.promotionId).session(session);
    }
    const account = await RewardAccount.findOneAndUpdate(
      { _id: userId, balance: { $gte: offer.points } },
      { $inc: { balance: -offer.points, totalRedeemed: offer.points } },
      { session, new: true, runValidators: true },
    );
    if (!account) throw new AppError("Bạn chưa đủ điểm để đổi ưu đãi này.", 409);
    const now = new Date();
    const [voucher] = await Promotion.create([{
      ownerId: userId, code: `HD${randomUUID().replace(/-/g, "").toUpperCase()}`,
      name: offer.name, description: "Ưu đãi dành riêng cho khách hàng đổi điểm Handigo",
      discountType: "AMOUNT", discountValue: offer.discountValue, minOrderAmount: offer.minOrderAmount,
      usageLimit: 1, startAt: now, endAt: new Date(now.getTime() + REWARD_POLICY.validityDays * 86_400_000),
    }], { session });
    await RewardTransaction.create([{
      _id: key, userId, kind: "REDEEM", points: -offer.points, balanceAfter: account.balance,
      promotionId: voucher._id, offerId, description: `Đổi ưu đãi ${offer.name}`,
    }], { session });
    return voucher;
  });
};
