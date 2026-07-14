import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Notification } from "../models/notification.model";
import { Address } from "../models/address.model";
import { Provider } from "../models/provider.model";
import { MatchingService, ProviderCandidate } from "./matching.service";
import { AppError } from "../utils/appError";
import { getNumberConfigValue } from "./systemConfig.service";
import { emitToUser } from "../sockets/socketServer";
import { getAssignmentRealtimePayload } from "./assignmentRealtime.service";
import { createLogger } from "../utils/logger";

/** Số giây một provider có thể phản hồi trước khi chuyển sang provider tiếp theo. */
const DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS = 60;

/** Số lượt matching tối đa trước khi hủy đơn. */
const DEFAULT_MAX_MATCHING_ATTEMPTS = 5;

/** Tổng thời gian matching tối đa trước khi hủy đơn. */
const DEFAULT_MAX_MATCHING_DURATION_SECONDS = 5 * 60;

/** Bắt đầu tìm thợ trước giờ hẹn bao nhiêu phút. */
const DEFAULT_SCHEDULED_DISPATCH_LEAD_MINUTES = 15;

/** Chu kỳ quét để khôi phục timeout sau khi backend restart. */
const MATCHING_TIMEOUT_SCAN_INTERVAL_MS = 10_000;

let timeoutMonitor: NodeJS.Timeout | null = null;
const dispatchLogger = createLogger("DispatchService");

interface DispatchContext {
  latitude?: number;
  longitude?: number;
  serviceId: string;
  province: string;
  ward: string;
}

async function getMatchingConfig() {
  const [
    maxMatchingAttemptsValue,
    matchingProviderTimeoutSecondsValue,
    maxMatchingDurationSecondsValue,
    scheduledDispatchLeadMinutesValue,
  ] = await Promise.all([
    getNumberConfigValue(
      "MAX_MATCHING_ATTEMPTS",
      DEFAULT_MAX_MATCHING_ATTEMPTS,
    ),
    getNumberConfigValue(
      "MATCHING_PROVIDER_TIMEOUT_SECONDS",
      DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS,
    ),
    getNumberConfigValue(
      "MAX_MATCHING_DURATION_SECONDS",
      DEFAULT_MAX_MATCHING_DURATION_SECONDS,
    ),
    getNumberConfigValue(
      "SCHEDULED_DISPATCH_LEAD_MINUTES",
      DEFAULT_SCHEDULED_DISPATCH_LEAD_MINUTES,
    ),
  ]);

  return {
    maxMatchingAttempts: Math.max(Math.floor(maxMatchingAttemptsValue), 1),
    matchingProviderTimeoutSeconds: Math.max(
      matchingProviderTimeoutSecondsValue,
      DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS,
    ),
    maxMatchingDurationSeconds: Math.max(
      maxMatchingDurationSecondsValue,
      1,
    ),
    scheduledDispatchLeadMinutes: Math.max(
      scheduledDispatchLeadMinutesValue,
      0,
    ),
  };
}

async function cancelUnmatchedOrder(orderId: string, reason: string) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "created" },
    {
      $set: {
        status: "cancelled",
        readyForMatching: false,
        cancellation: {
          cancelledByRole: "admin",
          reason,
          cancelledAt: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  );

  if (!order) return false;

  await OrderAssignment.updateMany(
    { orderId: order._id, status: "pending" },
    {
      $set: {
        status: "cancelled",
        respondedAt: new Date(),
      },
    },
  );

  await Notification.create({
    userId: order.customerId,
    type: "ORDER",
    title: "Đơn hàng đã được hủy",
    content: `Đơn ${order.orderCode} đã được hủy vì hệ thống chưa tìm được provider nhận đơn trong thời gian quy định.`,
    data: {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      status: "cancelled",
      reason,
    },
  });

  return true;
}

async function getDispatchContext(
  orderId: string,
): Promise<DispatchContext | null> {
  const order = await Order.findById(orderId).select("serviceId addressId");
  if (!order) return null;

  const address = await Address.findById(order.addressId).select(
    "latitude longitude province ward",
  );
  if (!address) return null;

  return {
    latitude: address.latitude,
    longitude: address.longitude,
    serviceId: order.serviceId.toString(),
    province: address.province,
    ward: address.ward,
  };
}

async function getTriedProviderState(orderId: Types.ObjectId | string) {
  const triedAssignments = await OrderAssignment.find({
    orderId,
    status: { $in: ["rejected", "timeout"] },
  })
    .select("providerId")
    .lean();

  return {
    triedProviderIds: [
      ...new Map(
        triedAssignments.map((item) => [
          item.providerId.toString(),
          item.providerId,
        ]),
      ).values(),
    ],
    attemptNumber: triedAssignments.length + 1,
  };
}

async function sendAssignment(
  orderId: string,
  candidate: ProviderCandidate,
  ctx: DispatchContext,
  triedProviderIds: Types.ObjectId[],
  attemptNumber: number,
  deadline: Date,
) {
  const assignment = await OrderAssignment.create({
    orderId: new Types.ObjectId(orderId),
    providerId: candidate.providerId,
    status: "pending",
    assignedAt: new Date(),
    responseDeadline: deadline,
  });

  const realtimeAssignment = await getAssignmentRealtimePayload(
    assignment._id.toString(),
  );
  emitToUser(candidate.userId.toString(), "assignment:new", {
    assignmentId: assignment._id.toString(),
    orderId,
    responseDeadline: deadline,
    assignment: realtimeAssignment,
  });

  dispatchLogger.info("Đã phân công đơn cho provider.", {
    orderId,
    providerId: candidate.providerId.toString(),
    attemptNumber,
    distanceMeters: candidate.distanceMeters,
    deadline: deadline.toISOString(),
  });

  const assignmentTimer = setTimeout(() => {
    DispatchService._onAssignmentTimeout(
      orderId,
      assignment._id.toString(),
      candidate.providerId,
      ctx,
      triedProviderIds,
      attemptNumber,
    ).catch((error: unknown) =>
      dispatchLogger.error("Xử lý timeout assignment thất bại.", error, {
        assignmentId: assignment._id.toString(),
        orderId,
      }),
    );
  }, Math.max(deadline.getTime() - Date.now(), 1));
  assignmentTimer.unref();
}

export const DispatchService = {
  /**
   * Khởi động matching đúng một lần sau khi đơn đã đủ điều kiện thanh toán
   * và đã đến cửa sổ điều phối của lịch hẹn.
   */
  async dispatchReadyOrder(orderId: string): Promise<void> {
    const {
      matchingProviderTimeoutSeconds,
      maxMatchingDurationSeconds,
      scheduledDispatchLeadMinutes,
    } = await getMatchingConfig();
    const order = await Order.findOne({
      _id: orderId,
      status: "created",
      readyForMatching: true,
    }).select(
      "serviceId addressId preferredProviderId orderType scheduledAt matchingStartedAt",
    );
    if (!order || order.matchingStartedAt) return;

    if (
      order.orderType !== "normal" &&
      order.scheduledAt &&
      order.scheduledAt.getTime() -
        scheduledDispatchLeadMinutes * 60 * 1000 >
        Date.now()
    ) {
      return;
    }

    const matchingStartedAt = new Date();
    const claimedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: "created",
        readyForMatching: true,
        matchingStartedAt: null,
      },
      { $set: { matchingStartedAt } },
      { returnDocument: "after", runValidators: true },
    );
    if (!claimedOrder) return;

    const ctx = await getDispatchContext(orderId);
    if (!ctx) {
      dispatchLogger.error("Không thể tạo ngữ cảnh điều phối cho đơn.", undefined, {
        orderId,
      });
      return;
    }

    if (claimedOrder.preferredProviderId) {
      const preferredCandidates = await MatchingService.findNearestProviders({
        ...ctx,
        onlyProviderId: claimedOrder.preferredProviderId,
        limit: 1,
      });
      const preferredCandidate = preferredCandidates[0];
      if (preferredCandidate) {
        const matchingDeadline = new Date(
          matchingStartedAt.getTime() + maxMatchingDurationSeconds * 1000,
        );
        const deadline = new Date(
          Math.min(
            Date.now() + matchingProviderTimeoutSeconds * 1000,
            matchingDeadline.getTime(),
          ),
        );
        await sendAssignment(
          orderId,
          preferredCandidate,
          ctx,
          [],
          1,
          deadline,
        );
        return;
      }

      dispatchLogger.info(
        "Provider ưu tiên không còn phù hợp, chuyển sang điều phối tự động.",
        { orderId, providerId: claimedOrder.preferredProviderId.toString() },
      );
    }

    await DispatchService.dispatchOrder(orderId, ctx);
  },

  /**
   * Tìm provider phù hợp và lần lượt gửi assignment cho từng provider.
   */
  async dispatchOrder(
    orderId: string,
    ctx: DispatchContext,
    triedProviderIds: Types.ObjectId[] = [],
    attemptNumber = 1,
  ): Promise<void> {
    const {
      maxMatchingAttempts,
      matchingProviderTimeoutSeconds,
      maxMatchingDurationSeconds,
    } = await getMatchingConfig();
    const order = await Order.findById(orderId).select(
      "status createdAt matchingStartedAt",
    );
    if (!order || order.status !== "created") return;

    const matchingDeadline = new Date(
      (order.matchingStartedAt || order.createdAt).getTime() +
        maxMatchingDurationSeconds * 1000,
    );
    if (matchingDeadline <= new Date()) {
      await cancelUnmatchedOrder(
        orderId,
        "Không có provider nhận đơn trong vòng 5 phút.",
      );
      return;
    }

    if (attemptNumber > maxMatchingAttempts) {
      await cancelUnmatchedOrder(
        orderId,
        `Không có provider nhận đơn sau ${maxMatchingAttempts} lượt matching.`,
      );
      dispatchLogger.warn("Không tìm được provider sau số lượt matching tối đa.", {
        orderId,
        maxMatchingAttempts,
      });
      return;
    }

    const candidates: ProviderCandidate[] =
      await MatchingService.findNearestProviders({
        latitude: ctx.latitude,
        longitude: ctx.longitude,
        serviceId: ctx.serviceId,
        province: ctx.province,
        ward: ctx.ward,
        excludeProviderIds: triedProviderIds,
        limit: 1,
      });

    if (candidates.length === 0) {
      dispatchLogger.warn("Chưa tìm được provider khả dụng, sẽ thử lại trước hạn matching.", {
        orderId,
      });

      const retryDelayMs = Math.min(
        matchingProviderTimeoutSeconds * 1000,
        Math.max(matchingDeadline.getTime() - Date.now(), 1),
      );
      const retryTimer = setTimeout(() => {
        DispatchService.dispatchOrder(
          orderId,
          ctx,
          triedProviderIds,
          attemptNumber,
        ).catch((error: unknown) =>
          dispatchLogger.error("Thử lại matching thất bại.", error, { orderId }),
        );
      }, retryDelayMs);
      retryTimer.unref();
      return;
    }

    const candidate = candidates[0];
    const deadline = new Date(
      Math.min(
        Date.now() + matchingProviderTimeoutSeconds * 1000,
        matchingDeadline.getTime(),
      ),
    );

    await sendAssignment(
      orderId,
      candidate,
      ctx,
      triedProviderIds,
      attemptNumber,
      deadline,
    );
  },

  /**
   * Đánh dấu assignment timeout và chuyển sang provider chưa được thử.
   */
  async _onAssignmentTimeout(
    orderId: string,
    assignmentId: string,
    timedOutProviderId: Types.ObjectId,
    ctx: DispatchContext,
    triedProviderIds: Types.ObjectId[],
    attemptNumber: number,
  ): Promise<void> {
    const assignment = await OrderAssignment.findOneAndUpdate(
      { _id: assignmentId, status: "pending" },
      {
        $set: {
          status: "timeout",
          respondedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
    if (!assignment) return;

    const provider = await Provider.findById(timedOutProviderId)
      .select("userId")
      .lean();
    if (provider) {
      emitToUser(provider.userId.toString(), "assignment:closed", {
        assignmentId,
        reason: "timeout",
      });
    }

    dispatchLogger.info("Assignment đã timeout, chuyển sang provider tiếp theo.", {
      assignmentId,
      orderId,
    });

    const order = await Order.findById(orderId);
    if (!order || order.status !== "created") return;

    const triedState = await getTriedProviderState(assignment.orderId);

    await DispatchService.dispatchOrder(
      orderId,
      ctx,
      triedState.triedProviderIds,
      triedState.attemptNumber,
    );
  },

  /**
   * Khôi phục timeout bị bỏ lỡ khi process restart và hủy đơn quá thời hạn.
   */
  startTimeoutMonitor(): void {
    if (timeoutMonitor) return;

    const scan = async (recoverStalledOrders = false) => {
      const {
        maxMatchingDurationSeconds,
        scheduledDispatchLeadMinutes,
      } = await getMatchingConfig();
      const now = new Date();
      const expiredAssignments = await OrderAssignment.find({
        status: "pending",
        responseDeadline: { $lte: now },
      })
        .sort({ responseDeadline: 1 })
        .limit(100)
        .lean();

      for (const assignment of expiredAssignments) {
        const ctx = await getDispatchContext(assignment.orderId.toString());
        if (!ctx) continue;

        const triedAssignments = await OrderAssignment.find({
          orderId: assignment.orderId,
          _id: { $ne: assignment._id },
          status: { $in: ["rejected", "timeout"] },
        })
          .select("providerId")
          .lean();

        await DispatchService._onAssignmentTimeout(
          assignment.orderId.toString(),
          assignment._id.toString(),
          assignment.providerId,
          ctx,
          triedAssignments.map((item) => item.providerId),
          triedAssignments.length + 1,
        );
      }

      const expiredOrders = await Order.find({
        status: "created",
        matchingStartedAt: {
          $ne: null,
          $lte: new Date(
            now.getTime() - maxMatchingDurationSeconds * 1000,
          ),
        },
      })
        .select("_id")
        .limit(100)
        .lean();

      for (const order of expiredOrders) {
        await cancelUnmatchedOrder(
          order._id.toString(),
          "Không có provider nhận đơn trong vòng 5 phút.",
        );
      }

      const readyOrders = await Order.find({
        status: "created",
        readyForMatching: true,
        matchingStartedAt: null,
        $or: [
          { orderType: "normal" },
          { scheduledAt: null },
          {
            scheduledAt: {
              $lte: new Date(
                now.getTime() + scheduledDispatchLeadMinutes * 60 * 1000,
              ),
            },
          },
        ],
      })
        .select("_id")
        .limit(100)
        .lean();

      for (const order of readyOrders) {
        await DispatchService.dispatchReadyOrder(order._id.toString());
      }

      if (recoverStalledOrders) {
        const activeOrders = await Order.find({
          status: "created",
          readyForMatching: true,
          matchingStartedAt: {
            $ne: null,
            $gt: new Date(
              now.getTime() - maxMatchingDurationSeconds * 1000,
            ),
          },
        })
          .select("_id")
          .limit(100)
          .lean();

        for (const order of activeOrders) {
          const hasPendingAssignment = await OrderAssignment.exists({
            orderId: order._id,
            status: "pending",
          });
          if (hasPendingAssignment) continue;

          const ctx = await getDispatchContext(order._id.toString());
          if (!ctx) continue;

          const triedState = await getTriedProviderState(order._id);
          dispatchLogger.info("Khôi phục matching cho đơn đang chờ.", {
            orderId: order._id.toString(),
            attemptNumber: triedState.attemptNumber,
          });
          await DispatchService.dispatchOrder(
            order._id.toString(),
            ctx,
            triedState.triedProviderIds,
            triedState.attemptNumber,
          );
        }
      }
    };

    scan(true).catch((error: unknown) =>
      dispatchLogger.error("Quét timeout ban đầu thất bại.", error),
    );
    timeoutMonitor = setInterval(() => {
      scan().catch((error: unknown) =>
        dispatchLogger.error("Quét timeout định kỳ thất bại.", error),
      );
    }, MATCHING_TIMEOUT_SCAN_INTERVAL_MS);
    timeoutMonitor.unref();
  },

  /**
   * Chạy lại matching thủ công cho đơn đang ở trạng thái created.
   */
  async redispatch(orderId: string): Promise<void> {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
    if (order.status !== "created") {
      throw new AppError(
        "Chỉ có thể re-dispatch đơn hàng ở trạng thái created.",
        400,
      );
    }

    const address = await Address.findById(order.addressId);
    const triedState = await getTriedProviderState(order._id);

    await DispatchService.dispatchOrder(
      order._id.toString(),
      {
        latitude: address?.latitude,
        longitude: address?.longitude,
        serviceId: order.serviceId.toString(),
        province: address?.province || "",
        ward: address?.ward || "",
      },
      triedState.triedProviderIds,
      triedState.attemptNumber,
    );
  },
};
