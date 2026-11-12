import { createHash } from "node:crypto";
import { Types } from "mongoose";
import type { RequestUser } from "../middlewares/authContext";
import { WalletTransaction, type IWalletTransaction } from "../models/walletTransaction.model";
import { RewardTransaction } from "../models/reward.model";
import { findStoredVoucher } from "./voucherStore.service";
import { getRewardOverview, redeemReward } from "./reward.service";
import { createWalletDeposit, syncWalletDeposit, cancelWalletDeposit } from "./wallet.service";
import { AppError } from "../utils/appError";

export const requireCustomerAction = (user: RequestUser, actionId?: string) => {
  if (user.role !== "CUSTOMER") throw new AppError("Chỉ khách hàng được dùng chức năng này.", 403);
  if (!actionId) throw new AppError("Thiếu mã hành động đã xác nhận.", 409);
  return actionId;
};
const depositId = (userId: string, actionId: string) =>
  new Types.ObjectId(createHash("sha256").update(`deposit:${userId}:${actionId}`).digest("hex").slice(0, 24));
const publicDeposit = (transaction: IWalletTransaction) => {
  const link = transaction.gatewayResponse?.paymentLink as { checkoutUrl?: string; qrCode?: string } | undefined;
  return { transactionId: String(transaction._id), orderCode: transaction.gatewayOrderCode, amount: transaction.amount,
    status: transaction.status, checkoutUrl: transaction.status === "pending" ? link?.checkoutUrl ?? null : null,
    path: "/customer/wallet", message: transaction.status === "success" ? "PayOS đã xác nhận nạp ví thành công."
      : transaction.status === "cancelled" ? "Liên kết nạp ví đã được đóng sau đối soát."
      : transaction.status === "failed" ? "Giao dịch nạp ví chưa thành công. Vui lòng kiểm tra trên trang Ví."
      : "Khoản nạp đang chờ thanh toán hoặc đối soát; chưa ghi nhận nạp ví thành công." };
};
const publicVoucher = (voucher: Awaited<ReturnType<typeof findStoredVoucher>>) => {
  if (!voucher) throw new AppError("Chưa tìm thấy voucher sau khi đổi điểm.", 409);
  return { voucherCode: voucher.code, name: voucher.name, discountType: voucher.discountType,
    discountValue: voucher.discountValue, minOrderAmount: voucher.minOrderAmount,
    maxDiscountAmount: voucher.maxDiscountAmount, endAt: voucher.endAt, applicableOrderType: voucher.applicableOrderType,
    path: "/customer/rewards", message: `Đã đổi điểm lấy ưu đãi ${voucher.name}. Mã của bạn: ${voucher.code}.` };
};

export const AgentCustomerAccountService = {
  async previewReward(userId: string, offerId: string) {
    const overview = await getRewardOverview(userId);
    const offer = overview.policy.offers.find((item) => item.id === offerId);
    if (!offer) throw new AppError("Ưu đãi không còn khả dụng. Vui lòng xem lại danh sách đổi điểm.", 409);
    if (overview.balance < offer.points) throw new AppError("Bạn chưa đủ điểm để đổi ưu đãi này.", 409);
    return { title: "Đổi điểm lấy voucher", offerId, offerName: offer.name, points: offer.points,
      pointsBalance: overview.balance, termsVersion: offer.termsVersion,
      discountType: offer.discountType ?? "AMOUNT", discountValue: offer.discountValue,
      minOrderAmount: offer.minOrderAmount, maxDiscountAmount: offer.maxDiscountAmount ?? null,
      validityDays: overview.policy.validityDays, applicableOrderType: offer.applicableOrderType ?? "fixed_price",
      note: "Điểm sẽ bị trừ sau xác nhận. Voucher được kiểm tra điều kiện riêng khi áp dụng vào đơn." };
  },
  async redeem(user: RequestUser, offerId: string, preview: unknown, actionId?: string) {
    const key = requireCustomerAction(user, actionId);
    const expected = preview as { termsVersion: string };
    return publicVoucher(await redeemReward(user.id, offerId, key, expected.termsVersion));
  },
  async reconcileReward(user: RequestUser, offerId: string, actionId?: string) {
    const key = requireCustomerAction(user, actionId);
    const record = await RewardTransaction.findById(`redeem:${user.id}:${key}`).lean();
    if (!record || record.offerId !== offerId) return null;
    const voucher = await findStoredVoucher({ _id: record.voucherId ?? record.promotionId, ownerId: user.id });
    return voucher ? publicVoucher(voucher) : null;
  },
  async createDeposit(user: RequestUser, amount: number, actionId?: string) {
    const key = requireCustomerAction(user, actionId);
    const result = await createWalletDeposit(user, { amount }, depositId(user.id, key));
    return publicDeposit(result.transaction);
  },
  async reconcileDeposit(user: RequestUser, amount: number, actionId?: string) {
    const key = requireCustomerAction(user, actionId);
    const record = await WalletTransaction.findOne({ _id: depositId(user.id, key), userId: user.id, type: "deposit", amount, isDeleted: false });
    // Chưa có liên kết lưu được không chứng minh PayOS chưa tạo; không tự tạo khoản nạp khác.
    if (!record?.gatewayOrderCode) return null;
    if (record.status === "success" || record.gatewayResponse?.paymentLink) return publicDeposit(record);
    const synced = await syncWalletDeposit(user, record.gatewayOrderCode);
    return synced && synced.status !== "pending" ? publicDeposit(synced) : null;
  },
  async previewCancelDeposit(user: RequestUser, orderCode: string) {
    const record = await WalletTransaction.findOne({ userId: user.id, type: "deposit", gatewayOrderCode: orderCode, isDeleted: false });
    if (!record || record.status !== "pending") throw new AppError("Khoản nạp không còn chờ thanh toán. Vui lòng kiểm tra trạng thái.", 409);
    return { title: "Hủy liên kết nạp ví", orderCode, amount: record.amount,
      note: "Chỉ đóng liên kết sau khi PayOS xác minh chưa nhận tiền; không hủy đơn dịch vụ." };
  },
  async statusDeposit(user: RequestUser, orderCode: string) {
    const record = await syncWalletDeposit(user, orderCode);
    if (!record) throw new AppError("Chưa xác định được trạng thái khoản nạp.", 409);
    return publicDeposit(record);
  },
  async cancelDeposit(user: RequestUser, orderCode: string) {
    const record = await cancelWalletDeposit(user, orderCode);
    if (!record) throw new AppError("Chưa xác định được kết quả hủy khoản nạp.", 409);
    return publicDeposit(record);
  },
  async reconcileCancelDeposit(user: RequestUser, orderCode: string) {
    const record = await syncWalletDeposit(user, orderCode);
    return record && ["cancelled", "success", "failed"].includes(record.status) ? publicDeposit(record) : null;
  },
};
