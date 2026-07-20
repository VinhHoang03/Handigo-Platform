import mongoose, { Types } from "mongoose";
import { Order, IOrder } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";
import { cancelOrderWithSettlement, cancelSystemOrderWithSettlement } from "./orderCancellation.service";
import { createNotificationRecord } from "./notification.service";
import { DispatchService } from "./dispatch.service";

export type ReassignmentDecision = "accept" | "decline";

const CUSTOMER_RESPONSE_TIMEOUT_MS = 15 * 60 * 1000;
const REASSIGNMENT_SCAN_INTERVAL_MS = 10_000;
const reassignmentLogger = createLogger("OrderReassignmentService");
let reassignmentMonitor: NodeJS.Timeout | null = null;

const requireObjectId = (value: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`${fieldName} không hợp lệ.`, 400);
  }
};

export const requestProviderReassignment = async (
  orderId: string,
  providerUserId: string,
  reasonInput: string,
): Promise<IOrder> => {
  requireObjectId(orderId, "ID đơn hàng");
  const reason = reasonInput.trim();
  if (!reason) throw new AppError("Vui lòng cung cấp lý do hủy đơn.", 400);

  const session = await mongoose.startSession();
  let updatedOrder: IOrder | null = null;
  let shouldNotify = false;

  try {
    await session.withTransaction(async () => {
      const provider = await Provider.findOne({
        userId: providerUserId,
        isDeleted: false,
      })
        .select("_id")
        .session(session);
      if (!provider) throw new AppError("Provider không tồn tại.", 404);

      const order = await Order.findById(orderId).session(session);
      if (!order || order.isDeleted) {
        throw new AppError("Đơn hàng không tồn tại.", 404);
      }

      if (
        order.reassignment?.status === "awaiting_customer" &&
        order.reassignment.requestedByProviderId.toString() === provider._id.toString()
      ) {
        updatedOrder = order;
        return;
      }

      if (!order.providerId || order.providerId.toString() !== provider._id.toString()) {
        throw new AppError("Bạn không có quyền hủy đơn hàng này.", 403);
      }
      if (order.status !== "accepted") {
        throw new AppError("Chỉ có thể yêu cầu đổi kỹ thuật viên khi đơn đã được nhận và chưa bắt đầu.", 409);
      }
      if (!['normal', 'urgent'].includes(order.orderType)) {
        throw new AppError("Luồng tìm kỹ thuật viên thay thế chưa áp dụng cho đơn lịch hẹn hoặc định kỳ.", 409);
      }
      if (order.currentQuotationId) {
        throw new AppError("Không thể tự động đổi kỹ thuật viên khi đơn đã phát sinh báo giá.", 409);
      }

      const now = new Date();
      const reassignment = {
        status: "awaiting_customer" as const,
        requestedByProviderId: provider._id,
        previousProviderIds: [provider._id],
        reason,
        requestedAt: now,
        expiresAt: new Date(now.getTime() + CUSTOMER_RESPONSE_TIMEOUT_MS),
        respondedAt: null,
      };

      updatedOrder = await Order.findOneAndUpdate(
        { _id: order._id, status: "accepted", providerId: provider._id },
        {
          $set: {
            status: "created",
            providerId: null,
            preferredProviderId: null,
            readyForMatching: false,
            matchingStartedAt: null,
            reassignment,
          },
        },
        { new: true, session, runValidators: true },
      );
      if (!updatedOrder) {
        throw new AppError("Đơn hàng vừa được xử lý bởi một yêu cầu khác.", 409);
      }
      shouldNotify = true;

      await Promise.all([
        OrderAssignment.updateOne(
          { orderId: order._id, providerId: provider._id, status: "accepted" },
          {
            $set: {
              status: "cancelled",
              rejectReason: reason,
              respondedAt: now,
            },
          },
          { session, runValidators: true },
        ),
        Provider.updateOne(
          { _id: provider._id },
          { $set: { availabilityStatus: "online" } },
          { session, runValidators: true },
        ),
      ]);
    });
  } finally {
    await session.endSession();
  }

  const result = await Order.findById(orderId);
  if (!updatedOrder || !result) {
    throw new AppError("Không thể tạo yêu cầu đổi kỹ thuật viên.", 500);
  }

  if (shouldNotify) try {
    await createNotificationRecord({
      userId: result.customerId,
      type: "ORDER",
      title: "Kỹ thuật viên không thể tiếp tục đơn hàng",
      content: `Kỹ thuật viên đã hủy đơn ${result.orderCode}. Vui lòng chọn tìm kỹ thuật viên khác hoặc hủy đơn để được hoàn tiền.`,
      data: {
        orderId: result._id,
        action: "order_reassignment_required",
        expiresAt: result.reassignment?.expiresAt,
      },
    });
  } catch (error) {
    reassignmentLogger.error("Không thể gửi thông báo đổi kỹ thuật viên.", error, { orderId });
  }

  return result;
};

export const requestDirectProviderReassignment = async (
  orderId: string,
  providerId: Types.ObjectId,
  reasonInput?: string,
): Promise<IOrder | null> => {
  requireObjectId(orderId, "ID đơn hàng");
  const now = new Date();
  const reason =
    reasonInput?.trim() || "Provider đã từ chối yêu cầu nhận đơn trực tiếp.";
  const reassignment = {
    status: "awaiting_customer" as const,
    requestedByProviderId: providerId,
    previousProviderIds: [providerId],
    reason,
    requestedAt: now,
    expiresAt: new Date(now.getTime() + CUSTOMER_RESPONSE_TIMEOUT_MS),
    respondedAt: null,
  };

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: "created",
      providerId: null,
      preferredProviderId: providerId,
    },
    {
      $set: {
        bookingStatus: "rejected",
        preferredProviderId: null,
        readyForMatching: false,
        matchingStartedAt: null,
        reassignment,
      },
    },
    { new: true, runValidators: true },
  );
  if (!order) return null;

  try {
    await createNotificationRecord({
      userId: order.customerId,
      type: "ORDER",
      title: "Provider đã từ chối yêu cầu",
      content: `Provider bạn chọn đã từ chối đơn ${order.orderCode}. Handigo có thể tự điều phối thợ gần nhất hoặc hoàn tiền về ví Handigo nếu bạn từ chối.`,
      data: {
        orderId: order._id,
        action: "order_reassignment_required",
        expiresAt: reassignment.expiresAt,
      },
    });
  } catch (error) {
    reassignmentLogger.error(
      "Không thể gửi thông báo provider từ chối yêu cầu trực tiếp.",
      error,
      { orderId },
    );
  }

  return order;
};

export const respondToProviderReassignment = async (
  orderId: string,
  customerId: string,
  decision: ReassignmentDecision,
): Promise<IOrder> => {
  requireObjectId(orderId, "ID đơn hàng");
  requireObjectId(customerId, "ID khách hàng");

  const now = new Date();
  const order = await Order.findOne({
    _id: orderId,
    customerId,
    status: "created",
    "reassignment.status": "awaiting_customer",
  });
  if (!order) {
    throw new AppError("Yêu cầu đổi kỹ thuật viên không còn khả dụng.", 409);
  }

  if (!order.reassignment || order.reassignment.expiresAt <= now) {
    const expiredOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: "created", "reassignment.status": "awaiting_customer" },
      { $set: { "reassignment.status": "expired", "reassignment.respondedAt": now } },
      { new: true, runValidators: true },
    );
    if (expiredOrder) {
      return cancelSystemOrderWithSettlement(
        orderId,
        "Khách hàng không phản hồi yêu cầu tìm kỹ thuật viên khác trong thời hạn.",
      );
    }
    throw new AppError("Yêu cầu đổi kỹ thuật viên vừa được xử lý.", 409);
  }

  if (decision === "decline") {
    const declinedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: "created", "reassignment.status": "awaiting_customer" },
      { $set: { "reassignment.status": "declined", "reassignment.respondedAt": now } },
      { new: true, runValidators: true },
    );
    if (!declinedOrder) throw new AppError("Yêu cầu đổi kỹ thuật viên vừa được xử lý.", 409);

    return cancelOrderWithSettlement({
      orderId,
      actorId: customerId,
      role: "customer",
      reason: "Khách hàng từ chối tìm kỹ thuật viên thay thế.",
    });
  }

  const matchingOrder = await Order.findOneAndUpdate(
    { _id: order._id, status: "created", "reassignment.status": "awaiting_customer" },
    {
      $set: {
        "reassignment.status": "matching",
        "reassignment.respondedAt": now,
        bookingStatus: "not_required",
        readyForMatching: true,
        matchingStartedAt: null,
      },
    },
    { new: true, runValidators: true },
  );
  if (!matchingOrder) throw new AppError("Yêu cầu đổi kỹ thuật viên vừa được xử lý.", 409);

  await DispatchService.dispatchReadyOrder(orderId);
  return (await Order.findById(orderId)) || matchingOrder;
};

const expirePendingReassignments = async () => {
  const now = new Date();
  const orders = await Order.find({
    status: "created",
    $or: [
      {
        "reassignment.status": "awaiting_customer",
        "reassignment.expiresAt": { $lte: now },
      },
      { "reassignment.status": { $in: ["declined", "expired"] } },
    ],
  })
    .select("_id")
    .limit(100)
    .lean();

  for (const order of orders) {
    const currentOrder = await Order.findById(order._id);
    if (!currentOrder || currentOrder.status !== "created") continue;
    const claimedOrder = currentOrder.reassignment?.status === "awaiting_customer"
      ? await Order.findOneAndUpdate(
          { _id: order._id, status: "created", "reassignment.status": "awaiting_customer" },
          { $set: { "reassignment.status": "expired", "reassignment.respondedAt": now } },
          { new: true, runValidators: true },
        )
      : currentOrder;
    if (!claimedOrder) continue;

    try {
      await cancelSystemOrderWithSettlement(
        claimedOrder._id.toString(),
        "Khách hàng không phản hồi yêu cầu tìm kỹ thuật viên khác trong thời hạn.",
      );
    } catch (error) {
      reassignmentLogger.error("Không thể hủy yêu cầu đổi kỹ thuật viên đã hết hạn.", error, {
        orderId: claimedOrder._id.toString(),
      });
    }
  }
};

export const startReassignmentMonitor = () => {
  if (reassignmentMonitor) return;
  expirePendingReassignments().catch((error: unknown) =>
    reassignmentLogger.error("Không thể quét yêu cầu đổi kỹ thuật viên.", error),
  );
  reassignmentMonitor = setInterval(() => {
    expirePendingReassignments().catch((error: unknown) =>
      reassignmentLogger.error("Không thể quét yêu cầu đổi kỹ thuật viên.", error),
    );
  }, REASSIGNMENT_SCAN_INTERVAL_MS);
  reassignmentMonitor.unref();
};

export const stopReassignmentMonitor = () => {
  if (!reassignmentMonitor) return;
  clearInterval(reassignmentMonitor);
  reassignmentMonitor = null;
};
