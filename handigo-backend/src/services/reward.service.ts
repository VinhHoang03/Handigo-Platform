import mongoose, { ClientSession, Types } from "mongoose";
import { createHash, randomUUID } from "crypto";
import { RewardAccount, RewardTransaction } from "../models/reward.model";
import { Voucher } from "../models/voucher.model";
import { findStoredVoucher, listStoredVouchers } from "./voucherStore.service";
import { IOrder, Order } from "../models/order.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { Payment } from "../models/payment.model";
import { REWARD_POLICY, calculateRewardPoints } from "../configs/rewards";
import { AppError } from "../utils/appError";
import { assertFeatureAllowed } from "./penaltyPolicy.service";
import type { RequestUser } from "../middlewares/authContext";
import { createConfig, getConfigByKey, getRewardOffers, getRewardPolicy, updateConfig } from "./systemConfig.service";
import { rewardOfferSchema, type AdminRewardOfferInput } from "../validations/reward.validator";

export const earnOrderRewards = async (order: IOrder, session: ClientSession) => {
  if (order.status !== "completed" || order.paymentStatus !== "paid") return;
  let rewardAmount = order.pricing.totalPaidAmount;
  if (order.inspectionRequired) {
    if (!order.depositPaidAt || !order.currentQuotationId) return;
    const quotation = await RepairQuotation.findOne({
      _id: order.currentQuotationId, orderId: order._id, customerId: order.customerId,
      providerId: order.providerId, isDeleted: false,
      $or: [{ status: "saved" }, { status: "approved", customerConfirmed: true }],
    }).session(session);
    if (!quotation) return;
    if (!quotation.directPaymentConfirmedAt || quotation.directPaymentConfirmedAmount == null) {
      const paidOnline = ["wallet", "bank"].includes(order.paymentMethod) && await Payment.exists({
        orderId: order._id, customerId: order.customerId, paymentType: "remaining", method: { $in: ["wallet", "payos"] }, status: "paid",
        "metadata.quotationId": quotation.id, "metadata.quotationRevision": quotation.revision ?? 0, isDeleted: false,
      }).session(session);
      if (!paidOnline) return;
    }
    // Tổng cuối cùng đã bao gồm phần cọc được khấu trừ, không cộng cọc lần nữa.
    rewardAmount = quotation.finalAmount;
  }
  const key = `earn:${order._id}`;
  if (await RewardTransaction.exists({ _id: key }).session(session)) return;
  const policy = await getRewardPolicy(session);
  const points = calculateRewardPoints(rewardAmount, policy.amountPerPoint);
  if (!points) return;
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
  const policy = await getRewardPolicy();
  const offers = await getRewardOffers();
  return {
    balance: account?.balance ?? 0, totalEarned: account?.totalEarned ?? 0,
    totalRedeemed: account?.totalRedeemed ?? 0,
    policy: { ...REWARD_POLICY, ...policy, offers: offers.filter((offer) => offer.isActive)
      .map((offer) => ({ ...offer, termsVersion: rewardTermsVersion(offer, policy.validityDays) })) },
  };
};

export const getRewardHistory = async (userId: string, page: number) => {
  const pageSize = 5;
  const filter = { userId: new Types.ObjectId(userId) };
  const [items, total] = await Promise.all([
    RewardTransaction.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    RewardTransaction.countDocuments(filter),
  ]);
  return { items, total, page, totalPages: Math.ceil(total / pageSize) };
};

export const getMyRewardVouchers = async (userId: string, page: number) => {
  const filter = { ownerId: new Types.ObjectId(userId), isDeleted: false, usedCount: { $not: { $gt: 0 } } };
  const all = await listStoredVouchers(filter);
  const total = all.length;
  const items = all.slice((page - 1) * 12, page * 12).map((voucher) => ({
    _id: voucher._id, code: voucher.code, name: voucher.name,
    discountType: voucher.discountType, discountValue: voucher.discountValue,
    maxDiscountAmount: voucher.maxDiscountAmount, minOrderAmount: voucher.minOrderAmount,
    startAt: voucher.startAt, endAt: voucher.endAt, usedCount: voucher.usedCount,
    neverExpires: voucher.neverExpires ?? false,
    isActive: voucher.isActive, status: voucher.status, reservedOrderId: voucher.reservedOrderId,
    applicableOrderType: voucher.applicableOrderType,
  }));
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

export const rewardTermsVersion = (offer: AdminRewardOfferInput, validityDays: number) =>
  createHash("sha256").update(JSON.stringify([
    offer.id, offer.name, offer.points, offer.discountType ?? "AMOUNT", offer.discountValue,
    offer.minOrderAmount, offer.maxDiscountAmount ?? null, offer.applicableOrderType ?? "fixed_price",
    offer.isActive, validityDays,
  ])).digest("hex");

export const redeemReward = async (userId: string, offerId: string, requestId: string, termsVersion?: string) => {
  const key = `redeem:${userId}:${requestId}`;
  return mongoose.connection.transaction(async (session) => {
    const previous = await RewardTransaction.findById(key).session(session);
    if (previous) {
      if (previous.offerId !== offerId) throw new AppError("Yêu cầu này đã được dùng cho ưu đãi khác.", 409);
      return findStoredVoucher({ _id: previous.voucherId ?? previous.promotionId }, session);
    }
    await assertFeatureAllowed(userId, "voucher", session);
    const offer = (await getRewardOffers(session)).find((item) => item.id === offerId && item.isActive);
    if (!offer) throw new AppError("Ưu đãi đổi điểm không tồn tại hoặc đã ngừng áp dụng.", 404);
    const policy = await getRewardPolicy(session);
    if (!termsVersion || termsVersion !== rewardTermsVersion(offer, policy.validityDays)) {
      throw new AppError("Điều kiện ưu đãi đã thay đổi. Vui lòng tải lại và xác nhận ưu đãi mới.", 409);
    }
    const account = await RewardAccount.findOneAndUpdate(
      { _id: userId, balance: { $gte: offer.points } },
      { $inc: { balance: -offer.points, totalRedeemed: offer.points } },
      { session, new: true, runValidators: true },
    );
    if (!account) throw new AppError("Bạn chưa đủ điểm để đổi ưu đãi này.", 409);
    const now = new Date();
    const [voucher] = await Voucher.create([{
      ownerId: userId, code: `HD${randomUUID().replace(/-/g, "").toUpperCase()}`,
      name: offer.name, description: "Ưu đãi dành riêng cho khách hàng đổi điểm Handigo",
      discountType: offer.discountType ?? "AMOUNT", discountValue: offer.discountValue, minOrderAmount: offer.minOrderAmount,
      applicableOrderType: offer.applicableOrderType ?? "fixed_price",
      maxDiscountAmount: offer.maxDiscountAmount ?? null,
      usageLimit: 1, startAt: now, endAt: new Date(now.getTime() + policy.validityDays * 86_400_000),
    }], { session });
    await RewardTransaction.create([{
      _id: key, userId, kind: "REDEEM", points: -offer.points, balanceAfter: account.balance,
      voucherId: voucher._id, offerId, description: `Đổi ưu đãi ${offer.name}`,
    }], { session });
    return voucher;
  });
};

export const getAdminRewardOffers = async (user: RequestUser) => {
  if (user.role !== "ADMIN") throw new AppError("Chỉ quản trị viên được quản lý gói đổi điểm.", 403);
  return getRewardOffers();
};

export const saveAdminRewardOffer = async (user: RequestUser, input: AdminRewardOfferInput) => {
  if (user.role !== "ADMIN") throw new AppError("Chỉ quản trị viên được quản lý gói đổi điểm.", 403);
  const offer = rewardOfferSchema.parse(input);
  const key = `REWARD_OFFER_${offer.id}`;
  let exists = false;
  try { await getConfigByKey(user, key); exists = true; }
  catch (error) { if (!(error instanceof AppError) || error.statusCode !== 404) throw error; }
  const config = { value: offer, type: "JSON" as const, isPublic: false, description: `Gói đổi điểm ${offer.name}` };
  if (exists) await updateConfig(user, key, config);
  else await createConfig(user, { key, ...config });
  return offer;
};
