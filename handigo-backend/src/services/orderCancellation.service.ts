import mongoose, { ClientSession, Types } from "mongoose";
import { payos } from "../configs/payos.config";
import { Order, IOrder } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Payment, IPayment } from "../models/payment.model";
import { Promotion } from "../models/promotion.model";
import { Provider } from "../models/provider.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";
import { buildTransactionCode } from "../utils/transaction";
import { createNotificationRecord } from "./notification.service";
import {
  calculateRefundPolicy,
  type RefundPolicyResult,
} from "./refundPolicy.service";

type CancellationRole = "customer" | "provider" | "admin";

interface CancelOrderInput {
  orderId: string;
  actorId?: string;
  role: CancellationRole;
  reason: string;
  system?: boolean;
}

interface WalletRefundResult {
  paymentId: Types.ObjectId;
  amount: number;
}

export interface CancellationPreview extends RefundPolicyResult {
  orderId: string;
  orderCode: string;
  scheduledAt: Date | null;
}

const CANCELLABLE_STATUSES = ["created", "accepted"] as const;
const REFUND_RECONCILIATION_INTERVAL_MS = 30_000;
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

const isPayoutSucceeded = (payout: any) =>
  payout?.approvalState === "COMPLETED" &&
  Array.isArray(payout.transactions) &&
  payout.transactions.some((item: any) => item.state === "SUCCEEDED");

const isPayoutFailed = (payout: any) =>
  ["REJECTED", "CANCELLED", "FAILED"].includes(payout?.approvalState) ||
  (Array.isArray(payout?.transactions) &&
    payout.transactions.some((item: any) =>
      ["CANCELLED", "REVERSED", "FAILED"].includes(item.state),
    ));

const finalizePayosRefund = async (
  payment: IPayment,
  payout: any,
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
  reason: string,
  payoutId: string,
) => {
  const payout = await payos.payouts.get(payoutId);

  if (isPayoutSucceeded(payout)) {
    await finalizePayosRefund(payment, payout, reason);
    return;
  }

  await storePayosRefundMetadata(payment._id as Types.ObjectId, {
    status: isPayoutFailed(payout) ? "failed" : "pending",
    payoutId: payout.id,
    referenceId: payout.referenceId,
    approvalState: payout.approvalState,
    checkedAt: new Date(),
  });
};

const refundPayosPaymentToWallet = async (
  payment: IPayment,
  order: IOrder,
  reason: string,
  refundAmount: number,
) => {
  const session = await mongoose.startSession();
  let creditedAmount = 0;

  try {
    await session.withTransaction(async () => {
      creditedAmount = 0;
      const currentPayment = await Payment.findById(payment._id).session(session);
      if (!currentPayment || currentPayment.status === "refunded") return;
      if (currentPayment.status !== "paid") {
        throw new AppError("Giao dịch không ở trạng thái có thể hoàn tiền", 409);
      }

      const existingWalletRefund = await WalletTransaction.findOne({
        relatedPaymentId: currentPayment._id,
        type: "refund",
        status: "success",
      }).session(session);
      const completedAt = new Date();
      const refundMetadata = buildRefundMetadata(
        order,
        refundAmount,
        "succeeded",
        {
          completedAt,
          sourceMethod: "payos",
          destination: "handigo_wallet",
        },
      );

      currentPayment.status = "refunded";
      currentPayment.refundedAt = completedAt;
      currentPayment.refundReason = reason;
      currentPayment.metadata = mergePaymentMetadata(currentPayment, {
        refund: refundMetadata,
      });
      await currentPayment.save({ session });

      if (refundAmount > 0 && !existingWalletRefund) {
        let wallet = await Wallet.findOneAndUpdate(
          { userId: currentPayment.customerId, isDeleted: false },
          { $inc: { balance: refundAmount } },
          { new: true, session, runValidators: true },
        );
        if (!wallet) {
          [wallet] = await Wallet.create(
            [
              {
                userId: currentPayment.customerId,
                balance: refundAmount,
                pendingBalance: 0,
                currency: "VND",
              },
            ],
            { session },
          );
        }
        if (!wallet) {
          throw new AppError("Không thể tạo ví hoàn tiền cho khách hàng", 500);
        }

        await WalletTransaction.create(
          [
            {
              walletId: wallet._id,
              userId: currentPayment.customerId,
              relatedOrderId: order._id,
              relatedPaymentId: currentPayment._id,
              type: "refund",
              direction: "in",
              amount: refundAmount,
              balanceAfter: wallet.balance,
              status: "success",
              transactionCode: buildTransactionCode("REFUND"),
              description: "Hoàn tiền PayOS vào ví Handigo",
              metadata: {
                orderCode: order.orderCode,
                sourceMethod: "payos",
                destination: "handigo_wallet",
                policyVersion: refundMetadata.policyVersion,
                refundRate: refundMetadata.rate,
              },
            },
          ],
          { session },
        );
        creditedAmount = refundAmount;
      }

      await refreshCancelledOrderPaymentStatus(order._id, session);
    });
  } finally {
    await session.endSession();
  }

  if (creditedAmount > 0) {
    try {
      await createNotificationRecord({
        userId: payment.customerId,
        type: "PAYMENT",
        title: "Hoàn tiền thành công",
        content: "Tiền hoàn đã được cộng vào ví Handigo của bạn.",
        data: {
          orderId: order._id,
          paymentId: payment._id,
          amount: creditedAmount,
          destination: "handigo_wallet",
        },
      });
    } catch (error) {
      cancellationLogger.error("Không thể tạo thông báo hoàn tiền vào ví.", error, {
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
  const existingRefund = (payment.metadata as any)?.refund;
  if (existingRefund?.payoutId) {
    await reconcilePayosRefund(payment, reason, existingRefund.payoutId);
    return;
  }

  if (
    existingRefund &&
    existingRefund.sourceMethod === "payos" &&
    existingRefund.destination !== "handigo_wallet"
  ) {
    const referenceId = "REFUND" + payment._id.toString();
    const payoutPage = await payos.payouts.list({ referenceId, limit: 1 });
    const existingPayout = payoutPage.data[0];
    if (existingPayout) {
      await storePayosRefundMetadata(payment._id as Types.ObjectId, {
        payoutId: existingPayout.id,
        referenceId: existingPayout.referenceId,
        approvalState: existingPayout.approvalState,
        checkedAt: new Date(),
      });
      await reconcilePayosRefund(payment, reason, existingPayout.id);
      return;
    }
  }

  await refundPayosPaymentToWallet(payment, order, reason, refundAmount);
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
      const currentRefund = (payment.metadata as any)?.refund;
      const retryCount = Number(currentRefund?.retryCount || 0) + 1;
      const retryDelayMs = Math.min(retryCount * 5 * 60_000, 60 * 60_000);
      cancellationLogger.error("Không thể xử lý hoàn tiền PayOS.", error, {
        orderId: order._id.toString(),
        paymentId: payment._id.toString(),
      });
      await storePayosRefundMetadata(payment._id as Types.ObjectId, {
        status: "retry_required",
        retryCount,
        nextRetryAt: new Date(Date.now() + retryDelayMs),
        checkedAt: new Date(),
        reason: error instanceof Error ? error.message : "Lỗi không xác định",
      });
    }
  }

  await refreshCancelledOrderPaymentStatus(order._id as Types.ObjectId);
};

const notifyCancellation = async (
  order: IOrder,
  walletRefunds: WalletRefundResult[],
  reason: string,
) => {
  await createNotificationRecord({
    userId: order.customerId,
    type: "ORDER",
    title: "Đơn hàng đã được hủy",
    content: "Đơn " + order.orderCode + " đã được hủy. Lý do: " + reason,
    data: {
      orderId: order._id,
      orderCode: order.orderCode,
      status: "cancelled",
      reason,
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
        refundPolicy.refundRate === 100 &&
        claimedOrder.voucherSnapshot?.voucherId
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
      await notifyCancellation(cancelledOrder, walletRefunds, reason);
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
) =>
  cancelOrderWithSettlement({
    orderId,
    role: "admin",
    reason,
    system: true,
  });

export const startRefundReconciliationMonitor = () => {
  if (refundMonitor) {
    return;
  }

  const scan = async () => {
    const now = new Date();
    const payments = await Payment.find({
      method: "payos",
      status: { $in: ["pending", "paid"] },
      $or: [
        {
          "metadata.refund.status": "pending",
          "metadata.refund.payoutId": { $exists: true },
        },
        {
          "metadata.refund.status": "retry_required",
          "metadata.refund.nextRetryAt": { $lte: now },
        },
        {
          "metadata.refund.status": "requesting",
          "metadata.refund.nextRetryAt": { $lte: now },
        },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(100);

    for (const payment of payments) {
      const refund = (payment.metadata as any)?.refund;
      if (!refund) {
        continue;
      }

      try {
        if (refund.payoutId) {
          await reconcilePayosRefund(
            payment,
            payment.refundReason || "Hoàn tiền đơn hàng đã hủy",
            refund.payoutId,
          );
        } else {
          await settleCancelledOrderPayments(
            payment.orderId,
            payment.refundReason || "Hoàn tiền đơn hàng đã hủy",
          );
        }
      } catch (error) {
        cancellationLogger.error("Đối soát payout PayOS thất bại.", error, {
          paymentId: payment._id.toString(),
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
