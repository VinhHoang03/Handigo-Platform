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

/** Số giây một provider có thể phản hồi trước khi chuyển sang provider tiếp theo. */
const DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS = 60;

/** Số lượt matching tối đa trước khi hủy đơn. */
const DEFAULT_MAX_MATCHING_ATTEMPTS = 5;

/** Tổng thời gian matching tối đa trước khi hủy đơn. */
const DEFAULT_MAX_MATCHING_DURATION_SECONDS = 5 * 60;

/** Chu kỳ quét để khôi phục timeout sau khi backend restart. */
const MATCHING_TIMEOUT_SCAN_INTERVAL_MS = 10_000;

let timeoutMonitor: NodeJS.Timeout | null = null;

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
  };
}

async function cancelUnmatchedOrder(orderId: string, reason: string) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "created" },
    {
      $set: {
        status: "cancelled",
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

export const DispatchService = {
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
    const order = await Order.findById(orderId).select("status createdAt");
    if (!order || order.status !== "created") return;

    const matchingDeadline = new Date(
      order.createdAt.getTime() + maxMatchingDurationSeconds * 1000,
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
      console.warn(
        `[DispatchService] No provider found for order ${orderId} after ${maxMatchingAttempts} attempts.`,
      );
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
      console.warn(
        `[DispatchService] No available provider found for order ${orderId}. Retrying until matching deadline.`,
      );

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
          console.error(
            `[DispatchService] Retry failed for order ${orderId}:`,
            error,
          ),
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

    console.log(
      `[DispatchService] Order ${orderId} assigned to provider ${candidate.providerId} ` +
        `(attempt #${attemptNumber}, dist: ${candidate.distanceMeters}m). ` +
        `Deadline: ${deadline.toISOString()}`,
    );

    const assignmentTimer = setTimeout(() => {
      DispatchService._onAssignmentTimeout(
        orderId,
        assignment._id.toString(),
        candidate.providerId,
        ctx,
        triedProviderIds,
        attemptNumber,
      ).catch((error: unknown) =>
        console.error(
          `[DispatchService] Timeout handling failed for assignment ${assignment._id}:`,
          error,
        ),
      );
    }, Math.max(deadline.getTime() - Date.now(), 1));
    assignmentTimer.unref();
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

    console.log(
      `[DispatchService] Assignment ${assignmentId} timed out. Retrying next provider...`,
    );

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
      const { maxMatchingDurationSeconds } = await getMatchingConfig();
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
        createdAt: {
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

      if (recoverStalledOrders) {
        const activeOrders = await Order.find({
          status: "created",
          createdAt: {
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
          console.log(
            `[DispatchService] Khôi phục matching cho đơn ${order._id} từ lượt ${triedState.attemptNumber}.`,
          );
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
      console.error("[DispatchService] Initial timeout scan failed:", error),
    );
    timeoutMonitor = setInterval(() => {
      scan().catch((error: unknown) =>
        console.error("[DispatchService] Timeout scan failed:", error),
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
