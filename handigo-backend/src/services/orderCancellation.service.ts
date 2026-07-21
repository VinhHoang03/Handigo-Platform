import mongoose, { ClientSession, Types } from "mongoose";
import { randomUUID } from "crypto";
import type { Payout } from "@payos/node";
import { payos, payoutPayos } from "../configs/payos.config";
import { Order, IOrder } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Payment, IPayment } from "../models/payment.model";
import { Promotion } from "../models/promotion.model";
import { Provider } from "../models/provider.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Refund, IRefund } from "../models/refund.model";
import User from "../models/user.model";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";
import { buildTransactionCode } from "../utils/transaction";
import { createNotificationRecord } from "./notification.service";
import {
  calculateRefundPolicy,
  type RefundPolicyResult,
} from "./refundPolicy.service";
import { getRefundRetryDecision } from "./refundProcessing";

type CancellationRole = "customer" | "provider" | "admin";
type SystemCancellationType = "payment_timeout" | "provider_unavailable";

interface CancelOrderInput {
  orderId: string;
  actorId?: string;
  role: CancellationRole;
  reason: string;
  system?: boolean;
  systemCancellationType?: SystemCancellationType;
}

interface WalletRefundResult {
  paymentId: Types.ObjectId;
  amount: number;
}

interface LegacyRefundMetadata {
  status?: string;
  amount?: number;
  referenceId?: string;
  channel?: string;
  destination?: string;
  payoutId?: string;
  approvalState?: string;
  retryCount?: number;
  nextRetryAt?: Date;
  completedAt?: Date;
}

export interface CancellationPreview extends RefundPolicyResult {
  orderId: string;
  orderCode: string;
  scheduledAt: Date | null;
}

const CANCELLABLE_STATUSES = ["created", "accepted"] as const;
const REFUND_RECONCILIATION_INTERVAL_MS = 30_000;
const REFUND_LEASE_MS = 60_000;
const REFUND_PENDING_RECHECK_MS = 30_000;
const REFUND_WORKER_ID = randomUUID();
const PAYOS_SOURCE_ACCOUNT_UNAVAILABLE_MESSAGE =
  "Chưa xác định được tài khoản nguồn để hoàn tiền PayOS";
const cancellationLogger = createLogger("OrderCancellationService");
let refundMonitor: NodeJS.Timeout | null = null;

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(fieldName + " không hợp lệ", 400);
  }
};

const assertCancellationAccess = async (
  order: IOrder,
  input: CancelOrderInput,
  session: ClientSession,
) => {
  if (input.system || input.role === "admin") {
    return;
  }

  if (!input.actorId) {
    throw new AppError("Không xác định được người thực hiện hủy đơn", 401);
  }

  if (
    input.role === "customer" &&
    order.customerId.toString() !== input.actorId
  ) {
    throw new AppError("Bạn không có quyền hủy đơn hàng này.", 403);
  }

  if (input.role === "provider") {
    const provider = await Provider.findOne({
      userId: input.actorId,
      isDeleted: false,
    })
      .select("_id")
      .session(session);

    if (
      !provider ||
      !order.providerId ||
      order.providerId.toString() !== provider._id.toString()
    ) {
      throw new AppError("Bạn không có quyền hủy đơn hàng này.", 403);
    }
  }
};

const getPaidPaymentAmount = (payment: IPayment) => {
  const actualAmountPaid = Number(
    (payment.metadata as Record<string, unknown> | null)?.actualAmountPaid,
  );
  return Math.max(
    0,
    Math.round(
      Number.isFinite(actualAmountPaid) && actualAmountPaid > 0
        ? actualAmountPaid
        : payment.amount,
    ),
  );
};

const mergePaymentMetadata = (
  payment: IPayment,
  patch: Record<string, unknown>,
) => ({
  ...((payment.metadata as Record<string, unknown> | null) || {}),
  ...patch,
});

const getPaidOrderAmount = async (
  orderId: Types.ObjectId | string,
  session?: ClientSession,
) => {
  const payments = await Payment.find({ orderId, status: "paid" }).session(
    session || null,
  );
  return payments.reduce((sum, payment) => sum + getPaidPaymentAmount(payment), 0);
};

const calculateOrderRefundPolicy = (
  order: IOrder,
  role: CancellationRole,
  paidAmount: number,
  now = new Date(),
) =>
  calculateRefundPolicy({
    role,
    orderType: order.orderType,
    orderStatus: order.status,
    scheduledAt: order.scheduledAt,
    hasAssignedProvider: Boolean(order.providerId),
    paidAmount,
    now,
  });

const getStoredRefundRate = (order: IOrder) => {
  const rate = Number(order.cancellation?.refundPolicy?.refundRate);
  return Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 100;
};

const getPaymentRefundAmount = (order: IOrder, payment: IPayment) =>
  Math.round((getPaidPaymentAmount(payment) * getStoredRefundRate(order)) / 100);

const buildRefundMetadata = (
  order: IOrder,
  amount: number,
  status: string,
  extra: Record<string, unknown> = {},
) => ({
  policyVersion:
    order.cancellation?.refundPolicy?.policyVersion || "LEGACY_FULL_REFUND",
  rate: getStoredRefundRate(order),
  amount,
  status,
  ...extra,
});

export const getCancellationPreview = async (input: {
  orderId: string;
  actorId?: string;
  role: CancellationRole;
}): Promise<CancellationPreview> => {
  assertObjectId(input.orderId, "ID đơn hàng");
  if (input.actorId) assertObjectId(input.actorId, "ID người thực hiện");

  const session = await mongoose.startSession();
  try {
    const order = await Order.findOne({
      _id: input.orderId,
      isDeleted: false,
    }).session(session);
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);

    await assertCancellationAccess(order, { ...input, reason: "Xem trước" }, session);
    const paidAmount = await getPaidOrderAmount(order._id as Types.ObjectId, session);
    const policy = calculateOrderRefundPolicy(order, input.role, paidAmount);

    return {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      scheduledAt: order.scheduledAt || null,
      ...policy,
    };
  } finally {
    await session.endSession();
  }
};

const refundWalletPayments = async (
  order: IOrder,
  reason: string,
  session: ClientSession,
) => {
  const refunded: WalletRefundResult[] = [];
  const payments = await Payment.find({
    orderId: order._id,
    method: "wallet",
    status: "paid",
  }).session(session);

  for (const payment of payments) {
    const refundAmount = getPaymentRefundAmount(order, payment);
    const existingRefund = await WalletTransaction.findOne({
      relatedPaymentId: payment._id,
      type: "refund",
      status: "success",
    }).session(session);

    if (existingRefund) {
      await Payment.updateOne(
        { _id: payment._id, status: "paid" },
        {
          $set: {
            status: "refunded",
            refundedAt: existingRefund.createdAt,
            refundReason: reason,
          },
        },
        { session },
      );
      continue;
    }

    const refundMetadata = buildRefundMetadata(
      order,
      refundAmount,
      "succeeded",
      { completedAt: new Date(), sourceMethod: "wallet" },
    );

    const claimedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "paid" },
      {
        $set: {
          status: "refunded",
          refundedAt: new Date(),
          refundReason: reason,
          metadata: mergePaymentMetadata(payment, { refund: refundMetadata }),
        },
      },
      { new: true, session, runValidators: true },
    );

    if (!claimedPayment) {
      continue;
    }

    if (refundAmount === 0) {
      continue;
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId: payment.customerId, isDeleted: false },
      { $inc: { balance: refundAmount } },
      { new: true, session },
    );

    if (!wallet) {
      throw new AppError("Không tìm thấy ví khách hàng để hoàn tiền", 500);
    }

    await WalletTransaction.create(
      [
        {
          walletId: wallet._id,
          userId: payment.customerId,
          relatedOrderId: order._id,
          relatedPaymentId: payment._id,
          type: "refund",
          direction: "in",
          amount: refundAmount,
          balanceAfter: wallet.balance,
          status: "success",
          transactionCode: buildTransactionCode("REFUND"),
          description: "Hoàn tiền đơn hàng đã hủy",
          metadata: {
            orderCode: order.orderCode,
            reason,
            sourceMethod: "wallet",
            policyVersion: refundMetadata.policyVersion,
            refundRate: refundMetadata.rate,
          },
        },
      ],
      { session },
    );

    refunded.push({
      paymentId: payment._id as Types.ObjectId,
      amount: refundAmount,
    });
  }

  return refunded;
};

const compensateProviderPayments = async (
  order: IOrder,
  session: ClientSession,
) => {
  if (!order.providerId || getStoredRefundRate(order) >= 100) return;

  const provider = await Provider.findOne({
    _id: order.providerId,
    isDeleted: false,
  })
    .select("userId")
    .session(session);
  if (!provider) return;

  const payments = await Payment.find({
    orderId: order._id,
    status: { $in: ["paid", "refunded"] },
    compensatedToProviderId: null,
  }).session(session);

  for (const payment of payments) {
    const cancellationFee =
      getPaidPaymentAmount(payment) - getPaymentRefundAmount(order, payment);
    const compensationAmount = Math.max(0, Math.round(cancellationFee * 0.8));
    if (compensationAmount === 0) continue;

    const claimedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $in: ["paid", "refunded"] },
        compensatedToProviderId: null,
      },
      {
        $set: {
          compensatedToProviderId: provider._id,
          compensatedAt: new Date(),
          metadata: mergePaymentMetadata(payment, {
            cancellationCompensation: {
              policyVersion:
                order.cancellation?.refundPolicy?.policyVersion ||
                "LEGACY_FULL_REFUND",
              amount: compensationAmount,
              rate: 80,
            },
          }),
        },
      },
      { new: true, session, runValidators: true },
    );
    if (!claimedPayment) continue;

    let wallet = await Wallet.findOne({
      userId: provider.userId,
      isDeleted: false,
    }).session(session);
    if (!wallet) {
      wallet = await Wallet.create(
        [
          {
            userId: provider.userId,
            balance: 0,
            pendingBalance: 0,
            currency: "VND",
          },
        ],
        { session },
      ).then((items) => items[0]);
    }
    if (!wallet) {
      throw new AppError("Không thể tạo ví bồi thường cho provider", 500);
    }

    wallet.balance += compensationAmount;
    await wallet.save({ session });

    await WalletTransaction.create(
      [
        {
          walletId: wallet._id,
          userId: provider.userId,
          relatedOrderId: order._id,
          relatedPaymentId: payment._id,
          type: "provider_earning",
          direction: "in",
          amount: compensationAmount,
          balanceAfter: wallet.balance,
          status: "success",
          transactionCode: buildTransactionCode("CANCEL_COMP"),
          description: "Bồi thường phí hủy đơn từ khách hàng",
          metadata: {
            source: "cancellation_fee",
            orderCode: order.orderCode,
            policyVersion:
              order.cancellation?.refundPolicy?.policyVersion ||
              "LEGACY_FULL_REFUND",
            refundRate: getStoredRefundRate(order),
          },
        },
      ],
      { session },
    );
  }
};

const compensateProviderPaymentsInTransaction = async (
  orderId: Types.ObjectId | string,
) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order || order.status !== "cancelled") return;
      await compensateProviderPayments(order, session);
    });
  } finally {
    await session.endSession();
  }
};

const refreshCancelledOrderPaymentStatus = async (
  orderId: Types.ObjectId | string,
  session?: ClientSession,
) => {
  const queryOptions = session ? { session } : undefined;
  const [paidPayment, refundedPayment] = await Promise.all([
    Payment.exists({ orderId, status: "paid" }).session(session || null),
    Payment.exists({ orderId, status: "refunded" }).session(session || null),
  ]);

  if (paidPayment) {
    return;
  }

  await Order.updateOne(
    { _id: orderId, status: "cancelled" },
    {
      $set: {
        paymentStatus: refundedPayment ? "refunded" : "unpaid",
        readyForMatching: false,
      },
    },
    queryOptions,
  );
};

const storePayosRefundMetadata = async (
  paymentId: Types.ObjectId,
  refund: Record<string, unknown>,
) => {
  const payment = await Payment.findById(paymentId).select("metadata");
  if (!payment) {
    return;
  }

  const currentMetadata =
    (payment.metadata as Record<string, unknown> | null) || {};
  const currentRefund =
    (currentMetadata.refund as Record<string, unknown> | undefined) || {};
  payment.metadata = {
    ...currentMetadata,
    refund: { ...currentRefund, ...refund },
  };
  await payment.save();
};

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

const ensurePayosRefundRecord = async (
  payment: IPayment,
  order: IOrder,
  reason: string,
  amount: number,
) => {
  const referenceId = "REFUND" + payment._id.toString();
  let refund: IRefund | null = null;
  try {
    refund = await Refund.findOneAndUpdate(
      { paymentId: payment._id },
      {
        $setOnInsert: {
          paymentId: payment._id,
          orderId: order._id,
          customerId: payment.customerId,
          amount,
          reason,
          currency: "VND",
          sourceMethod: "payos",
          status: "requested",
          referenceId,
          nextRetryAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    refund = await Refund.findOne({ paymentId: payment._id });
  }
  if (!refund) {
    throw new AppError("Không thể tạo yêu cầu hoàn tiền PayOS", 500);
  }

  const currentRefund = (
    payment.metadata as { refund?: LegacyRefundMetadata } | null
  )?.refund;
  if (!currentRefund?.status) {
    await storePayosRefundMetadata(payment._id as Types.ObjectId, {
      status: "requested",
      referenceId,
      amount,
      sourceMethod: "payos",
      requestedAt: new Date(),
    });
  }

  return refund;
};

const claimRefund = async (refundId: Types.ObjectId) => {
  const now = new Date();
  return Refund.findOneAndUpdate(
    {
      _id: refundId,
      isDeleted: false,
      status: { $in: ["requested", "requesting", "pending", "failed"] },
      $and: [
        {
          $or: [
            { nextRetryAt: null },
            { nextRetryAt: { $exists: false } },
            { nextRetryAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { $exists: false } },
            { leaseExpiresAt: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        status: "requesting",
        leaseOwner: REFUND_WORKER_ID,
        leaseExpiresAt: new Date(now.getTime() + REFUND_LEASE_MS),
        lastAttemptAt: now,
        lastError: null,
      },
    },
    { new: true, runValidators: true },
  );
};

const notifyAdminsAboutManualRefund = async (refund: IRefund) => {
  if (refund.adminAlertedAt) return;

  const admins = await User.find({
    role: "ADMIN",
    status: "active",
    isDeleted: false,
  }).select("_id");

  await Promise.all(
    admins.map((admin) =>
      createNotificationRecord({
        userId: admin._id,
        type: "PAYMENT",
        title: "Hoàn tiền PayOS cần xử lý thủ công",
        content: `Hoàn tiền ${refund.referenceId} đã vượt quá số lần thử tự động.`,
        data: {
          refundId: refund._id,
          paymentId: refund.paymentId,
          orderId: refund.orderId,
          amount: refund.amount,
          status: refund.status,
        },
      }),
    ),
  );

  await Refund.updateOne(
    { _id: refund._id, adminAlertedAt: null },
    { $set: { adminAlertedAt: new Date() } },
  );
};

const recordRefundFailure = async (refund: IRefund, error: unknown) => {
  const failedRefund = await Refund.findOneAndUpdate(
    { _id: refund._id, leaseOwner: REFUND_WORKER_ID },
    {
      $inc: { attemptCount: 1 },
      $set: {
        lastError: error instanceof Error ? error.message : "Lỗi không xác định",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    },
    { new: true, runValidators: true },
  );
  if (!failedRefund) return;

  const decision = getRefundRetryDecision(
    failedRefund.attemptCount,
    failedRefund.maxAttempts,
  );
  const updatedRefund = await Refund.findByIdAndUpdate(
    failedRefund._id,
    {
      $set: {
        status: decision.status,
        nextRetryAt: decision.nextRetryAt,
        manualReviewAt:
          decision.status === "manual_review" ? new Date() : null,
      },
    },
    { new: true, runValidators: true },
  );
  if (!updatedRefund) return;

  await storePayosRefundMetadata(updatedRefund.paymentId, {
    status: updatedRefund.status,
    referenceId: updatedRefund.referenceId,
    sourceMethod: "payos",
    destination: updatedRefund.destination,
    amount: updatedRefund.amount,
    retryCount: updatedRefund.attemptCount,
    nextRetryAt: updatedRefund.nextRetryAt,
    reason: updatedRefund.lastError,
  });

  if (updatedRefund.status === "manual_review") {
    await notifyAdminsAboutManualRefund(updatedRefund);
  }
};

const isPayoutSucceeded = (payout: Payout) =>
  payout?.approvalState === "COMPLETED" &&
  Array.isArray(payout.transactions) &&
  payout.transactions.some((item) => item.state === "SUCCEEDED");

const isPayoutFailed = (payout: Payout) =>
  ["REJECTED", "CANCELLED", "FAILED"].includes(payout?.approvalState) ||
  (Array.isArray(payout?.transactions) &&
    payout.transactions.some((item) =>
      ["CANCELLED", "REVERSED", "FAILED"].includes(item.state),
    ));

const buildPayoutAuditSnapshot = (payout: Payout) => ({
  approvalState: payout?.approvalState || null,
  transactionStates: Array.isArray(payout?.transactions)
    ? payout.transactions.map((item) => item.state).filter(Boolean)
    : [],
  capturedAt: new Date(),
});

const finalizePayosRefund = async (
  payment: IPayment,
  payout: Payout,
  reason: string,
  finalizedRefundAmount?: number,
) => {
  const now = new Date();
  const existingRefund =
    ((payment.metadata as Record<string, unknown> | null)?.refund as
      | Record<string, unknown>
      | undefined) || {};
  const refundMetadata = {
    ...existingRefund,
    status: "succeeded",
    sourceMethod: "payos",
    destination: "source_account",
    payoutId: payout.id,
    referenceId: payout.referenceId,
    completedAt: now,
    approvalState: payout.approvalState,
  };
  const refundAmount = Number(
    finalizedRefundAmount ?? existingRefund.amount ?? payment.amount,
  );

  await storePayosRefundMetadata(
    payment._id as Types.ObjectId,
    refundMetadata,
  );
  await Refund.updateOne(
    { paymentId: payment._id },
    {
      $set: {
        status: "succeeded",
        channel: "payos_payout",
        destination: "source_account",
        payoutId: payout.id,
        approvalState: payout.approvalState,
        providerResponse: buildPayoutAuditSnapshot(payout),
        completedAt: now,
        nextRetryAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    },
    { runValidators: true },
  );

  const refundedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "paid" },
    {
      $set: {
        status: "refunded",
        refundedAt: now,
        refundReason: reason,
      },
    },
    { new: true, runValidators: true },
  );

  if (!refundedPayment) {
    return;
  }

  await refreshCancelledOrderPaymentStatus(payment.orderId);
  try {
    await createNotificationRecord({
      userId: payment.customerId,
      type: "PAYMENT",
      title: "Hoàn tiền thành công",
      content: "Tiền của đơn hàng đã hủy đã được hoàn về tài khoản thanh toán.",
      data: {
        orderId: payment.orderId,
        paymentId: payment._id,
        amount: refundAmount,
        payoutId: payout.id,
      },
    });
  } catch (error) {
    cancellationLogger.error("Không thể tạo thông báo hoàn tiền.", error, {
      paymentId: payment._id.toString(),
      payoutId: payout.id,
    });
  }
};

const reconcilePayosRefund = async (
  payment: IPayment,
  refund: IRefund,
  reason: string,
  payoutId: string,
) => {
  const payout = await payoutPayos.payouts.get(payoutId);

  if (isPayoutSucceeded(payout)) {
    await finalizePayosRefund(payment, payout, reason, refund.amount);
    return;
  }

  if (isPayoutFailed(payout)) {
    throw new AppError("Payout PayOS hoàn tiền đã thất bại", 502);
  }

  await storePayosRefundMetadata(payment._id as Types.ObjectId, {
    status: "pending",
    sourceMethod: "payos",
    destination: "source_account",
    payoutId: payout.id,
    referenceId: payout.referenceId,
    approvalState: payout.approvalState,
    checkedAt: new Date(),
  });
  await Refund.updateOne(
    { _id: refund._id, leaseOwner: REFUND_WORKER_ID },
    {
      $set: {
        status: "pending",
        channel: "payos_payout",
        destination: "source_account",
        payoutId: payout.id,
        approvalState: payout.approvalState,
        providerResponse: buildPayoutAuditSnapshot(payout),
        nextRetryAt: new Date(Date.now() + REFUND_PENDING_RECHECK_MS),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    },
    { runValidators: true },
  );
};

const refundPayosPaymentToWallet = async (
  payment: IPayment,
  order: IOrder,
  reason: string,
  refundAmount: number,
) => {
  const session = await mongoose.startSession();
  let walletRefund: WalletRefundResult | null = null;

  try {
    await session.withTransaction(async () => {
      const existingRefund = await WalletTransaction.findOne({
        relatedPaymentId: payment._id,
        type: "refund",
        status: "success",
      }).session(session);

      if (existingRefund) {
        await Payment.updateOne(
          { _id: payment._id, status: "paid" },
          {
            $set: {
              status: "refunded",
              refundedAt: existingRefund.createdAt,
              refundReason: reason,
            },
          },
          { session, runValidators: true },
        );
        await refreshCancelledOrderPaymentStatus(order._id as Types.ObjectId, session);
        return;
      }

      const transactionalPayment = await Payment.findById(payment._id)
        .select("status metadata")
        .session(session);
      if (!transactionalPayment || transactionalPayment.status !== "paid") return;

      const currentRefund = (
        transactionalPayment.metadata as {
          refund?: { payoutId?: string; status?: string; reason?: string };
        } | null
      )?.refund;
      if (currentRefund?.payoutId) {
        throw new AppError(
          "Không thể hoàn vào ví vì payment đã có lệnh payout PayOS",
          409,
        );
      }
      if (
        currentRefund?.status === "retry_required" &&
        currentRefund.reason !== PAYOS_SOURCE_ACCOUNT_UNAVAILABLE_MESSAGE
      ) {
        throw new AppError(
          "Không thể hoàn vào ví vì trạng thái payout trước đó chưa chắc chắn",
          409,
        );
      }

      const now = new Date();
      const claimedPayment = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          status: "paid",
          "metadata.refund.payoutId": { $exists: false },
        },
        {
          $set: {
            status: "refunded",
            refundedAt: now,
            refundReason: reason,
            metadata: {
              ...((transactionalPayment.metadata as Record<string, unknown>) || {}),
              refund: {
                status: "succeeded",
                channel: "handigo_wallet",
                sourceMethod: "payos",
                destination: "handigo_wallet",
                referenceId: "REFUND" + payment._id.toString(),
                fallbackReason: "source_account_unavailable",
                amount: refundAmount,
                completedAt: now,
              },
            },
          },
        },
        { new: true, session, runValidators: true },
      );
      if (!claimedPayment) {
        await refreshCancelledOrderPaymentStatus(order._id as Types.ObjectId, session);
        return;
      }

      let wallet = await Wallet.findOne({
        userId: payment.customerId,
        isDeleted: false,
      }).session(session);
      if (!wallet) {
        [wallet] = await Wallet.create(
          [
            {
              userId: payment.customerId,
              balance: 0,
              pendingBalance: 0,
              currency: "VND",
            },
          ],
          { session },
        );
      }

      wallet.balance += refundAmount;
      await wallet.save({ session });

      await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: payment.customerId,
            relatedOrderId: order._id,
            relatedPaymentId: payment._id,
            type: "refund",
            direction: "in",
            amount: refundAmount,
            balanceAfter: wallet.balance,
            status: "success",
            transactionCode: buildTransactionCode("REFUND"),
            description: "Hoàn tiền PayOS về ví Handigo",
            metadata: {
              orderCode: order.orderCode,
              reason,
              sourceMethod: "payos",
              fallbackReason: "source_account_unavailable",
            },
          },
        ],
        { session },
      );

      walletRefund = {
        paymentId: payment._id as Types.ObjectId,
        amount: refundAmount,
      };
      await refreshCancelledOrderPaymentStatus(order._id as Types.ObjectId, session);
    });
  } finally {
    await session.endSession();
  }

  await Refund.updateOne(
    { paymentId: payment._id },
    {
      $set: {
        status: "succeeded",
        channel: "handigo_wallet",
        destination: "handigo_wallet",
        completedAt: new Date(),
        nextRetryAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    },
    { runValidators: true },
  );

  if (walletRefund) {
    try {
      await createNotificationRecord({
        userId: payment.customerId,
        type: "PAYMENT",
        title: "Hoàn tiền thành công",
        content:
          "PayOS không cung cấp tài khoản nguồn. Tiền đã được hoàn vào ví Handigo của bạn.",
        data: {
          orderId: order._id,
          paymentId: payment._id,
          amount: refundAmount,
          refundChannel: "handigo_wallet",
        },
      });
    } catch (error) {
      cancellationLogger.error("Không thể gửi thông báo hoàn tiền về ví.", error, {
        orderId: order._id.toString(),
        paymentId: payment._id.toString(),
      });
    }
  }
};

const requestPayosRefund = async (
  payment: IPayment,
  order: IOrder,
  reason: string,
  refundAmount: number,
) => {
  const queuedRefund = await ensurePayosRefundRecord(
    payment,
    order,
    reason,
    refundAmount,
  );
  const refund = await claimRefund(queuedRefund._id as Types.ObjectId);
  if (!refund) return;

  try {
    if (refund.payoutId) {
      await reconcilePayosRefund(payment, refund, reason, refund.payoutId);
      return;
    }

    const payoutPage = await payoutPayos.payouts.list({
      referenceId: refund.referenceId,
      limit: 1,
    });
    const existingPayout = payoutPage.data[0];
    if (existingPayout) {
      refund.payoutId = existingPayout.id;
      await refund.save();
      await reconcilePayosRefund(payment, refund, reason, existingPayout.id);
      return;
    }

    const paymentLink = await payos.paymentRequests.get(
      Number(payment.gatewayOrderCode),
    );
    const sourceTransaction = paymentLink.transactions.find(
      (item) =>
        item.counterAccountBankId &&
        item.counterAccountNumber &&
        item.amount >= refundAmount,
    );

    if (!sourceTransaction) {
      await refundPayosPaymentToWallet(payment, order, reason, refundAmount);
      return;
    }

    await storePayosRefundMetadata(payment._id as Types.ObjectId, {
      status: "requesting",
      referenceId: refund.referenceId,
      sourceMethod: "payos",
      destination: "source_account",
      amount: refundAmount,
      requestedAt: new Date(),
    });
    refund.channel = "payos_payout";
    refund.destination = "source_account";
    await refund.save();

    const payout = await payoutPayos.payouts.create(
      {
        referenceId: refund.referenceId,
        amount: refundAmount,
        description: "Hoan tien Handigo",
        toBin: sourceTransaction.counterAccountBankId as string,
        toAccountNumber: sourceTransaction.counterAccountNumber as string,
      },
      refund.referenceId,
    );

    refund.payoutId = payout.id;
    refund.approvalState = payout.approvalState;
    refund.providerResponse = buildPayoutAuditSnapshot(payout);
    await refund.save();
    await reconcilePayosRefund(payment, refund, reason, payout.id);
  } catch (error) {
    await recordRefundFailure(refund, error);
    throw error;
  }
};

const settlePendingPayosPayment = async (
  payment: IPayment,
  order: IOrder,
  reason: string,
) => {
  if (!payment.gatewayOrderCode) {
    await Payment.updateOne(
      { _id: payment._id, status: "pending" },
      {
        $set: {
          status: "failed",
          failedAt: new Date(),
          failureReason: "Đơn hàng đã hủy",
        },
      },
    );
    return;
  }

  const paymentLink = await payos.paymentRequests.get(
    Number(payment.gatewayOrderCode),
  );

  if (paymentLink.status === "PAID" || paymentLink.amountPaid > 0) {
    const paidAt = new Date();
    const paidPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "pending" },
      {
        $set: {
          status: "paid",
          paidAt,
          metadata: {
            ...((payment.metadata as Record<string, unknown>) || {}),
            actualAmountPaid: paymentLink.amountPaid,
          },
        },
      },
      { new: true, runValidators: true },
    );

    if (paidPayment) {
      const actualPaidAmount = getPaidPaymentAmount(paidPayment);
      const refundAmount = getPaymentRefundAmount(order, paidPayment);
      const cancellationFee = actualPaidAmount - refundAmount;
      const providerCompensation = order.providerId
        ? Math.round(cancellationFee * 0.8)
        : 0;
      const platformRetainedAmount = cancellationFee - providerCompensation;

      const detectedPaymentStatus =
        payment.paymentType === "inspection_deposit" ||
        paymentLink.amountPaid < payment.amount
          ? "partially_paid"
          : "paid";
      await Order.updateOne(
        { _id: order._id, status: "cancelled" },
        {
          $set: {
            paymentStatus: detectedPaymentStatus,
            readyForMatching: false,
          },
          ...(order.cancellation?.refundPolicy
            ? {
                $inc: {
                  "cancellation.refundPolicy.paidAmount": actualPaidAmount,
                  "cancellation.refundPolicy.refundAmount": refundAmount,
                  "cancellation.refundPolicy.cancellationFee": cancellationFee,
                  "cancellation.refundPolicy.providerCompensation":
                    providerCompensation,
                  "cancellation.refundPolicy.platformRetainedAmount":
                    platformRetainedAmount,
                },
              }
            : {}),
        },
      );

      await compensateProviderPaymentsInTransaction(order._id as Types.ObjectId);

      await requestPayosRefund(
        paidPayment,
        order,
        reason,
        refundAmount,
      );
    }
    return;
  }

  if (!["CANCELLED", "EXPIRED", "FAILED"].includes(paymentLink.status)) {
    await payos.paymentRequests.cancel(
      Number(payment.gatewayOrderCode),
      "Đơn hàng Handigo đã hủy",
    );
  }

  await Payment.updateOne(
    { _id: payment._id, status: "pending" },
    {
      $set: {
        status: "failed",
        failedAt: new Date(),
        failureReason: "Đơn hàng đã hủy trước khi thanh toán",
      },
    },
  );
};

export const settleCancelledOrderPayments = async (
  orderId: string | Types.ObjectId,
  reason: string,
) => {
  const order = await Order.findById(orderId);
  if (!order || order.status !== "cancelled") {
    return;
  }

  const payments = await Payment.find({
    orderId: order._id,
    method: "payos",
    status: { $in: ["pending", "paid"] },
  });

  await compensateProviderPaymentsInTransaction(order._id as Types.ObjectId);

  for (const payment of payments) {
    try {
      if (payment.status === "pending") {
        await settlePendingPayosPayment(payment, order, reason);
      } else {
        await requestPayosRefund(
          payment,
          order,
          reason,
          getPaymentRefundAmount(order, payment),
        );
      }
    } catch (error) {
      cancellationLogger.error("Không thể xử lý hoàn tiền PayOS.", error, {
        orderId: order._id.toString(),
        paymentId: payment._id.toString(),
      });
    }
  }

  await refreshCancelledOrderPaymentStatus(order._id as Types.ObjectId);
};

const notifyCancellation = async (
  order: IOrder,
  walletRefunds: WalletRefundResult[],
  reason: string,
  systemCancellationType?: SystemCancellationType,
) => {
  const customerNotification =
    systemCancellationType === "payment_timeout"
      ? {
          title: "Đơn hàng đã hủy do quá hạn thanh toán",
          content:
            "Đơn " +
            order.orderCode +
            " đã tự động hủy vì bạn chưa thanh toán trong thời hạn giữ lịch.",
        }
      : systemCancellationType === "provider_unavailable"
        ? {
            title: "Đơn hàng đã hủy vì chưa tìm được chuyên gia",
            content:
              "Handigo chưa tìm được chuyên gia nhận đơn " +
              order.orderCode +
              " trong thời gian quy định. Vui lòng đặt lại khi phù hợp.",
          }
        : {
            title: "Đơn hàng đã được hủy",
            content: "Đơn " + order.orderCode + " đã được hủy. Lý do: " + reason,
          };

  await createNotificationRecord({
    userId: order.customerId,
    type: "ORDER",
    title: customerNotification.title,
    content: customerNotification.content,
    data: {
      orderId: order._id,
      orderCode: order.orderCode,
      status: "cancelled",
      reason,
      systemCancellationType,
    },
  });

  for (const refund of walletRefunds) {
    await createNotificationRecord({
      userId: order.customerId,
      type: "PAYMENT",
      title: "Hoàn tiền thành công",
      content: "Tiền đã được hoàn về ví Handigo của bạn.",
      data: {
        orderId: order._id,
        paymentId: refund.paymentId,
        amount: refund.amount,
      },
    });
  }

  if (order.providerId) {
    const provider = await Provider.findById(order.providerId).select("userId");
    if (provider) {
      await createNotificationRecord({
        userId: provider.userId,
        type: "ORDER",
        title: "Đơn hàng đã được hủy",
        content: "Đơn " + order.orderCode + " đã được hủy.",
        data: {
          orderId: order._id,
          orderCode: order.orderCode,
          status: "cancelled",
          reason,
        },
      });
    }
  }
};

export const cancelOrderWithSettlement = async (
  input: CancelOrderInput,
): Promise<IOrder> => {
  assertObjectId(input.orderId, "ID đơn hàng");
  if (input.actorId) {
    assertObjectId(input.actorId, "ID người thực hiện");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new AppError("Vui lòng cung cấp lý do hủy.", 400);
  }

  const session = await mongoose.startSession();
  let cancelledOrder: IOrder | null = null;
  let newlyCancelled = false;
  let walletRefunds: WalletRefundResult[] = [];

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(input.orderId).session(session);
      if (!order || order.isDeleted) {
        throw new AppError("Đơn hàng không tồn tại.", 404);
      }

      await assertCancellationAccess(order, input, session);

      if (order.status === "cancelled") {
        cancelledOrder = order;
        return;
      }

      if (!CANCELLABLE_STATUSES.includes(order.status as any)) {
        throw new AppError(
          'Không thể hủy đơn hàng ở trạng thái "' + order.status + '".',
          400,
        );
      }

      const cancelledAt = new Date();
      const paidAmount = await getPaidOrderAmount(
        order._id as Types.ObjectId,
        session,
      );
      const refundPolicy = calculateOrderRefundPolicy(
        order,
        input.role,
        paidAmount,
        cancelledAt,
      );
      if (!refundPolicy.canCancel) {
        throw new AppError(refundPolicy.policyReason, 409);
      }

      const cancellation: Record<string, unknown> = {
        cancelledByRole: input.role,
        reason,
        cancelledAt,
        refundPolicy: {
          policyVersion: refundPolicy.policyVersion,
          refundRate: refundPolicy.refundRate,
          paidAmount: refundPolicy.paidAmount,
          refundAmount: refundPolicy.refundAmount,
          cancellationFee: refundPolicy.cancellationFee,
          providerCompensation: refundPolicy.providerCompensation,
          platformRetainedAmount: refundPolicy.platformRetainedAmount,
          hoursBeforeStart: refundPolicy.hoursBeforeStart,
          policyReason: refundPolicy.policyReason,
        },
      };
      if (input.actorId) {
        cancellation.cancelledBy = new Types.ObjectId(input.actorId);
      }

      const claimedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          status: order.status,
        },
        {
          $set: {
            status: "cancelled",
            readyForMatching: false,
            cancellation,
          },
        },
        {
          new: true,
          session,
          runValidators: Boolean(input.actorId),
        },
      );

      if (!claimedOrder) {
        throw new AppError("Đơn hàng vừa được xử lý bởi yêu cầu khác.", 409);
      }

      newlyCancelled = true;
      cancelledOrder = claimedOrder;

      await OrderAssignment.updateMany(
        { orderId: claimedOrder._id, status: "pending" },
        {
          $set: {
            status: "cancelled",
            respondedAt: new Date(),
          },
        },
        { session },
      );

      if (
        claimedOrder.voucherSnapshot?.voucherId &&
        claimedOrder.voucherUsedAt
      ) {
        await Promotion.updateOne(
          {
            _id: claimedOrder.voucherSnapshot.voucherId,
            usedCount: { $gt: 0 },
          },
          { $inc: { usedCount: -1 } },
          { session },
        );
      }

      await Payment.updateMany(
        {
          orderId: claimedOrder._id,
          method: "cash",
          status: "pending",
        },
        {
          $set: {
            status: "failed",
            failedAt: new Date(),
            failureReason: "Đơn hàng đã hủy",
          },
        },
        { session },
      );

      walletRefunds = await refundWalletPayments(
        claimedOrder,
        reason,
        session,
      );
      await compensateProviderPayments(claimedOrder, session);

      if (claimedOrder.providerId && claimedOrder.orderType === "normal") {
        await Provider.updateOne(
          { _id: claimedOrder.providerId },
          { $set: { availabilityStatus: "online" } },
          { session },
        );
      }

      await refreshCancelledOrderPaymentStatus(claimedOrder._id, session);
    });
  } finally {
    await session.endSession();
  }

  if (!cancelledOrder) {
    throw new AppError("Không thể hủy đơn hàng", 500);
  }

  await settleCancelledOrderPayments(input.orderId, reason);

  if (newlyCancelled) {
    try {
      await notifyCancellation(
        cancelledOrder,
        walletRefunds,
        reason,
        input.systemCancellationType,
      );
    } catch (error) {
      cancellationLogger.error("Không thể tạo thông báo hủy đơn.", error, {
        orderId: input.orderId,
      });
    }
  }

  const result = await Order.findById(input.orderId);
  if (!result) {
    throw new AppError("Đơn hàng không tồn tại.", 404);
  }

  return result;
};

export const cancelSystemOrderWithSettlement = async (
  orderId: string,
  reason: string,
  systemCancellationType?: SystemCancellationType,
) =>
  cancelOrderWithSettlement({
    orderId,
    role: "admin",
    reason,
    system: true,
    systemCancellationType,
  });

export const backfillLegacyPayosRefunds = async (limit = 500) => {
  const payments = await Payment.find({
    method: "payos",
    status: { $in: ["paid", "refunded"] },
    "metadata.refund.status": { $exists: true },
    isDeleted: false,
  })
    .sort({ updatedAt: 1 })
    .limit(limit);

  let createdCount = 0;
  for (const payment of payments) {
    if (await Refund.exists({ paymentId: payment._id })) continue;

    const order = await Order.findById(payment.orderId).select(
      "customerId orderCode cancellation",
    );
    if (!order) continue;

    const legacyRefund =
      (
        payment.metadata as { refund?: LegacyRefundMetadata } | null
      )?.refund || {};
    const legacyStatus = String(legacyRefund.status || "requested");
    const status =
      payment.status === "refunded" || legacyStatus === "succeeded"
        ? "succeeded"
        : legacyStatus === "pending"
          ? "pending"
          : "failed";
    const referenceId =
      String(legacyRefund.referenceId || "") ||
      "REFUND" + payment._id.toString();

    const result = await Refund.updateOne(
      { paymentId: payment._id },
      {
        $setOnInsert: {
          paymentId: payment._id,
          orderId: payment.orderId,
          customerId: payment.customerId,
          amount: Number(legacyRefund.amount ?? payment.amount),
          reason:
            payment.refundReason ||
            order.cancellation?.reason ||
            "Hoàn tiền đơn hàng đã hủy",
          currency: "VND",
          sourceMethod: "payos",
          channel:
            legacyRefund.channel === "handigo_wallet"
              ? "handigo_wallet"
              : legacyRefund.payoutId
                ? "payos_payout"
                : null,
          destination:
            legacyRefund.destination === "handigo_wallet"
              ? "handigo_wallet"
              : legacyRefund.payoutId
                ? "source_account"
                : null,
          status,
          referenceId,
          payoutId: legacyRefund.payoutId || null,
          approvalState: legacyRefund.approvalState || null,
          attemptCount: Number(legacyRefund.retryCount || 0),
          nextRetryAt:
            status === "succeeded"
              ? null
              : legacyRefund.nextRetryAt || new Date(),
          completedAt:
            status === "succeeded"
              ? legacyRefund.completedAt || payment.refundedAt || new Date()
              : null,
        },
      },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount > 0) createdCount += 1;
  }

  return { scannedCount: payments.length, createdCount };
};

const processRefundJob = async (refund: IRefund) => {
  const [payment, order] = await Promise.all([
    Payment.findById(refund.paymentId),
    Order.findById(refund.orderId),
  ]);

  if (payment?.status === "refunded") {
    await Refund.updateOne(
      { _id: refund._id },
      {
        $set: {
          status: "succeeded",
          completedAt: payment.refundedAt || new Date(),
          nextRetryAt: null,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      },
      { runValidators: true },
    );
    return;
  }

  if (!payment || !order || order.status !== "cancelled" || payment.status !== "paid") {
    const claimedRefund = await claimRefund(refund._id as Types.ObjectId);
    if (claimedRefund) {
      await recordRefundFailure(
        claimedRefund,
        new AppError("Dữ liệu payment hoặc order không hợp lệ để hoàn tiền", 409),
      );
    }
    return;
  }

  await requestPayosRefund(payment, order, refund.reason, refund.amount);
};

export const retryPayosRefundByPaymentId = async (paymentId: string) => {
  assertObjectId(paymentId, "ID giao dịch");
  const refund = await Refund.findOneAndUpdate(
    {
      paymentId,
      status: { $in: ["failed", "manual_review"] },
      isDeleted: false,
    },
    {
      $set: {
        status: "requested",
        attemptCount: 0,
        nextRetryAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
        manualReviewAt: null,
        adminAlertedAt: null,
      },
    },
    { new: true, runValidators: true },
  );
  if (!refund) {
    throw new AppError(
      "Không tìm thấy yêu cầu hoàn tiền PayOS cần thử lại",
      404,
    );
  }

  await storePayosRefundMetadata(refund.paymentId, {
    status: "requested",
    referenceId: refund.referenceId,
    sourceMethod: "payos",
    destination: refund.destination,
    amount: refund.amount,
    retryCount: 0,
    nextRetryAt: refund.nextRetryAt,
    reason: null,
  });

  try {
    await processRefundJob(refund);
  } catch (error) {
    cancellationLogger.error("Thử lại hoàn tiền PayOS chưa thành công.", error, {
      refundId: refund._id.toString(),
      paymentId,
    });
  }

  return Refund.findById(refund._id);
};

export const startRefundReconciliationMonitor = () => {
  if (refundMonitor) {
    return;
  }

  const scan = async () => {
    const now = new Date();
    await backfillLegacyPayosRefunds(100);
    const refunds = await Refund.find({
      status: { $in: ["requested", "requesting", "pending", "failed"] },
      isDeleted: false,
      $and: [
        {
          $or: [
            { nextRetryAt: null },
            { nextRetryAt: { $exists: false } },
            { nextRetryAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { $exists: false } },
            { leaseExpiresAt: { $lte: now } },
          ],
        },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(100);

    for (const refund of refunds) {
      try {
        await processRefundJob(refund);
      } catch (error) {
        cancellationLogger.error("Đối soát payout PayOS thất bại.", error, {
          refundId: refund._id.toString(),
          paymentId: refund.paymentId.toString(),
          payoutId: refund.payoutId,
        });
      }
    }
  };

  scan().catch((error: unknown) =>
    cancellationLogger.error("Quét hoàn tiền PayOS ban đầu thất bại.", error),
  );
  refundMonitor = setInterval(() => {
    scan().catch((error: unknown) =>
      cancellationLogger.error("Quét hoàn tiền PayOS định kỳ thất bại.", error),
    );
  }, REFUND_RECONCILIATION_INTERVAL_MS);
  refundMonitor.unref();
};

export const stopRefundReconciliationMonitor = () => {
  if (!refundMonitor) {
    return;
  }

  clearInterval(refundMonitor);
  refundMonitor = null;
};
