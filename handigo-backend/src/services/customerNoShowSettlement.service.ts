import { ClientSession, Types } from "mongoose";
import type { IOrder } from "../models/order.model";
import { Report } from "../models/report.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { AppError } from "../utils/appError";
import { assertCustomerNoShowWait, CUSTOMER_NO_SHOW_COMPENSATION } from "../utils/customerNoShow";
import { lockProviderSchedule } from "./providerSchedule.service";
import { CustomerNoShowEvidence } from "../models/customerNoShowEvidence.model";
import { verifyNoShowEvidence } from "./customerNoShowVerification.service";
import { releaseProviderAfterNoShow } from "./providerPresence.service";
import { getOrderOperationPolicy } from "./systemConfig.service";

export interface CustomerNoShowReview {
  automated?: boolean;
  reportId: string;
  reviewNote?: string | null;
  resolutionNote?: string | null;
}

// Thực hiện cùng transaction hủy đơn và hoàn tiền; Handigo chi khoản hỗ trợ riêng.
export const settleCustomerNoShow = async (
  order: IOrder,
  adminId: string | undefined,
  review: CustomerNoShowReview,
  session: ClientSession,
) => {
  if (!review.automated && !adminId) throw new AppError("Không xác định được quản trị viên duyệt báo cáo.", 403);
  if (order.status !== "accepted" || !order.providerId || order.customerNoShow?.status !== "pending"
    || String(order.customerNoShow.reportId) !== review.reportId) {
    throw new AppError("Đơn hoặc báo cáo đã thay đổi, chưa thể chấp thuận hỗ trợ.", 409);
  }
  const provider = await lockProviderSchedule(order.providerId, session);
  const { customerNoShowWaitMinutes } = await getOrderOperationPolicy(session);
  assertCustomerNoShowWait(order, Date.now(), customerNoShowWaitMinutes);
  if (order.currentQuotationId) throw new AppError("Đơn đã có báo giá, cần kiểm tra lại trước khi xử lý khách vắng mặt.", 409);
  if (review.automated) {
    const ids = order.customerNoShow.evidenceIds ?? [];
    const evidence = await CustomerNoShowEvidence.find({ _id: { $in: ids }, orderId: order._id, providerUserId: provider.userId, isDeleted: false }).session(session);
    if (ids.length < 2 || evidence.length !== ids.length) throw new AppError("Bằng chứng chưa đủ để tự duyệt.", 409);
    const verification = await verifyNoShowEvidence(order, String(provider.userId), evidence, session);
    if (verification.decision !== "auto_eligible") throw new AppError("Dữ liệu mới chưa đủ điều kiện tự duyệt; chuyển quản trị viên xem xét.", 409);
  }
  const now = new Date();
  const report = await Report.findOneAndUpdate({
    _id: review.reportId, orderId: order._id, reporterId: provider.userId,
    isCustomerNoShow: true, status: { $in: review.automated ? ["pending"] : ["pending", "under_review"] }, isDeleted: false,
    ...(review.automated ? { "noShowVerification.decision": "auto_eligible" } : {}),
  }, { $set: {
    status: "confirmed", handledBy: review.automated ? null : new Types.ObjectId(adminId!), handledAt: now,
    reviewedByType: review.automated ? "system" : "admin",
    reviewNote: review.reviewNote?.trim() || null,
    resolutionNote: review.resolutionNote?.trim() || "Chấp thuận báo cáo khách vắng mặt. Handigo hỗ trợ thợ 5.000đ, không thu thêm của khách.",
  } }, { session, new: true, runValidators: true });
  if (!report) throw new AppError("Báo cáo đã được xử lý hoặc không thuộc thợ hiện tại.", 409);

  const wallet = await Wallet.findOneAndUpdate({ userId: provider.userId, isDeleted: false }, {
    $inc: { balance: CUSTOMER_NO_SHOW_COMPENSATION },
    $setOnInsert: { pendingBalance: 0, currency: "VND" },
  }, { session, new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  if (!wallet) throw new AppError("Không thể cập nhật ví hỗ trợ của thợ.", 500);
  await WalletTransaction.create([{
    walletId: wallet._id, userId: provider.userId, relatedOrderId: order._id,
    type: "adjustment", direction: "in", amount: CUSTOMER_NO_SHOW_COMPENSATION,
    balanceAfter: wallet.balance, status: "success", transactionCode: `NO_SHOW_${order._id}`,
    description: `Handigo hỗ trợ khách vắng mặt - đơn ${order.orderCode}`,
    metadata: { source: "customer_no_show_support", fundedBy: "platform", reportId: review.reportId,
      approvedBy: review.automated ? null : adminId, approvedByType: review.automated ? "system" : "admin" },
  }], { session });
  order.customerNoShow.status = "approved";
  order.customerNoShow.reviewedAt = now;
  order.customerNoShow.compensationAmount = CUSTOMER_NO_SHOW_COMPENSATION;

  await releaseProviderAfterNoShow(provider._id, order._id, session);
};
