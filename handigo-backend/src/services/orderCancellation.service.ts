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

    const claimedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "paid" },
      {
        $set: {
          status: "refunded",
          refundedAt: new Date(),
          refundReason: reason,
        },
      },
      { new: true, session, runValidators: true },
    );

    if (!claimedPayment) {
      continue;
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId: payment.customerId, isDeleted: false },
      { $inc: { balance: payment.amount } },
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
          amount: payment.amount,
          balanceAfter: wallet.balance,
          status: "success",
          transactionCode: buildTransactionCode("REFUND"),
          description: "Hoàn tiền đơn hàng đã hủy",
          metadata: {
            orderCode: order.orderCode,
            reason,
            sourceMethod: "wallet",
          },
        },
      ],
      { session },
    );

    refunded.push({
      paymentId: payment._id as Types.ObjectId,
      amount: payment.amount,
    });
  }

  return refunded;
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

  payment.metadata = {
    ...((payment.metadata as Record<string, unknown>) || {}),
    refund,
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
) => {
  const now = new Date();
  const refundMetadata = {
    status: "succeeded",
    payoutId: payout.id,
    referenceId: payout.referenceId,
    completedAt: now,
    approvalState: payout.approvalState,
  };

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
        amount: payment.amount,
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

const requestPayosRefund = async (
  payment: IPayment,
  order: IOrder,
  reason: string,
  refundAmount = payment.amount,
) => {
  const existingRefund = (payment.metadata as any)?.refund;
  if (existingRefund?.payoutId) {
    await reconcilePayosRefund(payment, reason, existingRefund.payoutId);
    return;
  }

  if (!payment.gatewayOrderCode) {
    throw new AppError("Giao dịch PayOS thiếu mã đối soát", 409);
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
    throw new AppError(
      "Chưa xác định được tài khoản nguồn để hoàn tiền PayOS",
      409,
    );
  }

  const referenceId = "REFUND" + payment._id.toString();
  const payout = await payos.payouts.create(
    {
      referenceId,
      amount: refundAmount,
      description: "Hoan tien Handigo",
      toBin: sourceTransaction.counterAccountBankId as string,
      toAccountNumber: sourceTransaction.counterAccountNumber as string,
    },
    referenceId,
  );

  await storePayosRefundMetadata(payment._id as Types.ObjectId, {
    status: isPayoutSucceeded(payout)
      ? "succeeded"
      : isPayoutFailed(payout)
        ? "failed"
        : "pending",
    payoutId: payout.id,
    referenceId,
    requestedAt: new Date(),
    approvalState: payout.approvalState,
    amount: refundAmount,
    orderCode: order.orderCode,
  });

  if (isPayoutSucceeded(payout)) {
    await finalizePayosRefund(payment, payout, reason);
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
        },
      );

      await requestPayosRefund(
        paidPayment,
        order,
        reason,
        paymentLink.amountPaid,
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

  for (const payment of payments) {
    try {
      if (payment.status === "pending") {
        await settlePendingPayosPayment(payment, order, reason);
      } else {
        await requestPayosRefund(payment, order, reason);
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

      const cancellation: Record<string, unknown> = {
        cancelledByRole: input.role,
        reason,
        cancelledAt: new Date(),
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

      if (claimedOrder.voucherSnapshot?.voucherId) {
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
