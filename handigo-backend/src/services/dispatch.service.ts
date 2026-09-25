import { Types } from "mongoose";
import { Order } from "../models/order.model";
import User from "../models/user.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Address } from "../models/address.model";
import { Provider } from "../models/provider.model";
import { MatchingService, ProviderCandidate } from "./matching.service";
import { AppError } from "../utils/appError";
import { getNumberConfigValue } from "./systemConfig.service";
import { emitToUser } from "../sockets/socketServer";
import { getAssignmentRealtimePayload } from "./assignmentRealtime.service";
import { createLogger } from "../utils/logger";
import { cancelSystemOrderWithSettlement } from "./orderCancellation.service";
import { createNotificationRecord } from "./notification.service";
import { reconcilePayosPaymentForExpiration } from "./payment.service";
import { getOrderInterval } from "./providerSchedule.service";
import { getBookingPolicy } from "./systemConfig.service";
import { ScheduleInterval } from "../utils/bookingPolicy";

/** Số giây một provider có thể phản hồi trước khi chuyển sang provider tiếp theo. */
const DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS = 60;

/** Số provider nhận cùng một lượt đề nghị để cạnh tranh nhận đơn. */
const DEFAULT_MATCHING_BATCH_SIZE = 3;

/** Thời gian phản hồi dành riêng cho yêu cầu customer chọn provider cụ thể. */
export const DIRECT_PROVIDER_RESPONSE_TIMEOUT_MS = 2 * 60 * 1000;

/** Số provider tối đa được thử sau khi khách đồng ý tìm provider thay thế. */
export const MAX_DIRECT_PROVIDER_ATTEMPTS = 3;

/** Số lượt matching tối đa trước khi hủy đơn. */
const DEFAULT_MAX_MATCHING_ATTEMPTS = 5;

/** Tổng thời gian matching tối đa trước khi hủy đơn. */
const DEFAULT_MAX_MATCHING_DURATION_SECONDS = 6 * 60;

/** Bắt đầu tìm thợ trước giờ hẹn bao nhiêu phút. */
const DEFAULT_SCHEDULED_DISPATCH_LEAD_MINUTES = 15;

/** Chu kỳ quét để khôi phục timeout sau khi backend restart. */
const MATCHING_TIMEOUT_SCAN_INTERVAL_MS = 10_000;

let timeoutMonitor: NodeJS.Timeout | null = null;
const dispatchLogger = createLogger("DispatchService");

interface DispatchContext {
  scheduleIntervals?: ScheduleInterval[];
  latitude?: number;
  longitude?: number;
  serviceId: string;
  province: string;
  ward: string;
  scheduledDates?: Date[];
}

async function getMatchingConfig() {
  const [
    maxMatchingAttemptsValue,
    matchingProviderTimeoutSecondsValue,
    maxMatchingDurationSecondsValue,
    scheduledDispatchLeadMinutesValue,
    matchingBatchSizeValue,
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
    getNumberConfigValue("MATCHING_BATCH_SIZE", DEFAULT_MATCHING_BATCH_SIZE),
  ]);

  return {
    maxMatchingAttempts: Math.max(Math.floor(maxMatchingAttemptsValue), 1),
    matchingProviderTimeoutSeconds: Math.max(
      matchingProviderTimeoutSecondsValue,
      DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS,
    ),
    maxMatchingDurationSeconds: Math.max(
      maxMatchingDurationSecondsValue,
      DEFAULT_MAX_MATCHING_DURATION_SECONDS,
    ),
    scheduledDispatchLeadMinutes: Math.max(
      scheduledDispatchLeadMinutesValue,
      0,
    ),
    matchingBatchSize: Math.max(Math.floor(matchingBatchSizeValue), 1),
  };
}

export async function getMaxMatchingDurationSeconds(): Promise<number> {
  const { maxMatchingDurationSeconds } = await getMatchingConfig();
  return maxMatchingDurationSeconds;
}

async function cancelUnmatchedOrder(orderId: string, reason: string) {
  const order = await Order.findById(orderId).select("status recurringGroupId");
  if (!order || order.status !== "created") {
    return false;
  }

  await Order.updateOne(
    { _id: orderId, "reassignment.status": "matching" },
    { $set: { "reassignment.status": "failed" } },
  );
  const orderIds = order.recurringGroupId
    ? await Order.find({
        recurringGroupId: order.recurringGroupId,
        status: "created",
        isDeleted: false,
      }).distinct("_id")
    : [order._id];
  for (const currentOrderId of orderIds) {
    await cancelSystemOrderWithSettlement(
      currentOrderId.toString(),
      reason,
      "provider_unavailable",
    );
  }
  return true;
}

async function getDispatchContext(
  orderId: string,
): Promise<DispatchContext | null> {
  const order = await Order.findById(orderId);
  if (!order) return null;

  const address = await Address.findById(order.addressId).select(
    "latitude longitude province ward",
  );
  if (!address) return null;

  const scheduledDates = order.recurringGroupId
    ? (await Order.find({
        recurringGroupId: order.recurringGroupId,
        status: "created",
        isDeleted: false,
      })
        .select("scheduledAt")
        .sort({ occurrenceNumber: 1 })
        .lean())
        .map((item) => item.scheduledAt)
        .filter((date): date is Date => date instanceof Date)
    : order.scheduledAt
      ? [order.scheduledAt]
      : [];

  const policy = await getBookingPolicy();
  const interval = getOrderInterval(order, policy);
  const duration = interval.end - interval.start;
  const dates = scheduledDates.length ? scheduledDates : [new Date(Date.now() + interval.travelMinutes * 60000)];
  return {
    latitude: address.latitude,
    longitude: address.longitude,
    serviceId: order.serviceId.toString(),
    province: address.province,
    ward: address.ward,
    scheduledDates,
    scheduleIntervals: dates.map((date) => ({ ...interval, start: date.getTime(), end: date.getTime() + duration })),
  };
}

async function getTriedProviderState(orderId: Types.ObjectId | string) {
  const order = await Order.findById(orderId)
    .select("reassignment")
    .lean();
  const isReassignment = order?.reassignment?.status === "matching";
  const triedAssignments = await OrderAssignment.find({
    orderId,
    status: { $in: ["rejected", "timeout"] },
    ...(isReassignment && order.reassignment?.respondedAt
      ? { assignedAt: { $gte: order.reassignment.respondedAt } }
      : {}),
  })
    .select("providerId")
    .lean();

  return {
    triedProviderIds: [
      ...new Map(
        [
          ...(isReassignment ? order.reassignment?.previousProviderIds || [] : []),
          ...triedAssignments.map((item) => item.providerId),
        ].map((providerId) => [providerId.toString(), providerId]),
      ).values(),
    ],
    attemptNumber: triedAssignments.length + 1,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

async function sendAssignmentBatch(
  orderId: string,
  candidates: ProviderCandidate[],
  ctx: DispatchContext,
  batchNumber: number,
  deadline: Date,
) {
  const isAppointment = Boolean(ctx.scheduledDates?.length);
  const assignedAt = new Date();
  const createAssignment = (candidate: ProviderCandidate) =>
    OrderAssignment.create({
      orderId: new Types.ObjectId(orderId),
      providerId: candidate.providerId,
      assignmentType: isAppointment ? "appointment" : "dispatch",
      status: "pending",
      assignedAt,
      responseDeadline: deadline,
    });

  const [firstCandidate, ...remainingCandidates] = candidates;
  if (!firstCandidate) return;

  const assignments = [];
  try {
    assignments.push(await createAssignment(firstCandidate));
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      dispatchLogger.info("Nhóm phân phối đã được tiến trình khác tạo.", {
        orderId,
        batchNumber,
      });
      return;
    }
    throw error;
  }

  for (const candidate of remainingCandidates) {
    try {
      assignments.push(await createAssignment(candidate));
    } catch (error: unknown) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  const candidateByProviderId = new Map(
    candidates.map((candidate) => [candidate.providerId.toString(), candidate]),
  );

  for (const assignment of assignments) {
    const candidate = candidateByProviderId.get(assignment.providerId.toString());
    if (!candidate) continue;

    const realtimeAssignment = await getAssignmentRealtimePayload(
      assignment._id.toString(),
    );
    emitToUser(candidate.userId.toString(), "assignment:new", {
      assignmentId: assignment._id.toString(),
      orderId,
      responseDeadline: deadline,
      assignment: realtimeAssignment,
    });
    if (isAppointment) {
      await createNotificationRecord({
        userId: candidate.userId,
        type: "ORDER",
        title: "Yêu cầu lịch hẹn mới",
        content: `Handigo đề xuất một lịch hẹn vào ${ctx.scheduledDates?.[0]?.toLocaleString("vi-VN")}.`,
        data: { orderId, assignmentId: assignment._id },
      });
    }

    const assignmentTimer = setTimeout(() => {
      DispatchService._onAssignmentTimeout(
        orderId,
        assignment._id.toString(),
        candidate.providerId,
        ctx,
      ).catch((error: unknown) =>
        dispatchLogger.error("Xử lý timeout assignment thất bại.", error, {
          assignmentId: assignment._id.toString(),
          orderId,
        }),
      );
    }, Math.max(deadline.getTime() - Date.now(), 1));
    assignmentTimer.unref();
  }

  dispatchLogger.info("Đã phát đơn cho nhóm provider.", {
    orderId,
    batchNumber,
    providerCount: assignments.length,
    providerIds: candidates.map((candidate) => candidate.providerId.toString()),
    deadline: deadline.toISOString(),
  });
}

async function sendDirectProviderRequest(
  orderId: string,
  candidate: ProviderCandidate,
  ctx: DispatchContext,
  deadline: Date,
) {
  const assignment = await OrderAssignment.create({
    orderId: new Types.ObjectId(orderId),
    providerId: candidate.providerId,
    assignmentType: "direct_request",
    status: "pending",
    assignedAt: new Date(),
    responseDeadline: deadline,
  });

  const realtimeAssignment = await getAssignmentRealtimePayload(
    assignment._id.toString(),
  );
  emitToUser(candidate.userId.toString(), "direct-request:new", {
    assignmentId: assignment._id.toString(),
    orderId,
    responseDeadline: deadline,
    assignment: realtimeAssignment,
  });
  await createNotificationRecord({
    userId: candidate.userId,
    type: "ORDER",
    title: "Khách hàng gửi yêu cầu trực tiếp",
    content: "Một khách hàng đã chọn bạn để thực hiện đơn dịch vụ mới.",
    data: { orderId, assignmentId: assignment._id },
  });

  const assignmentTimer = setTimeout(() => {
    DispatchService._onAssignmentTimeout(
      orderId,
      assignment._id.toString(),
      candidate.providerId,
      ctx,
    ).catch((error: unknown) =>
      dispatchLogger.error("Xử lý timeout yêu cầu trực tiếp thất bại.", error, {
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
   * để thợ có thể xác nhận lịch hẹn ngay sau khi khách thanh toán.
   */
  async dispatchReadyOrder(orderId: string): Promise<void> {
    const order = await Order.findOne({
      _id: orderId,
      status: "created",
      readyForMatching: true,
    }).select(
      "customerId orderCode serviceId addressId preferredProviderId orderType scheduledAt matchingStartedAt",
    );
    if (!order || order.matchingStartedAt) return;

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
        requireOnline: !ctx.scheduledDates?.length,
      });
      const preferredCandidate = preferredCandidates[0];
      if (preferredCandidate) {
        const deadline = new Date(
          Date.now() + DIRECT_PROVIDER_RESPONSE_TIMEOUT_MS,
        );
        await Order.updateOne(
          { _id: claimedOrder._id, status: "created" },
          { $set: { bookingStatus: "awaiting_provider" } },
          { runValidators: true },
        );
        await sendDirectProviderRequest(orderId, preferredCandidate, ctx, deadline);
        return;
      }

      await Order.updateOne(
        { _id: claimedOrder._id, status: "created" },
        {
          $set: {
            bookingStatus: "rejected",
            preferredProviderId: null,
            readyForMatching: false,
            matchingStartedAt: null,
          },
        },
        { runValidators: true },
      );
      await createNotificationRecord({
        userId: claimedOrder.customerId,
        type: "ORDER",
        title: "Không thể gửi yêu cầu trực tiếp",
        content: `Provider đã chọn không còn phù hợp với đơn ${claimedOrder.orderCode}. Vui lòng chọn provider khác.`,
        data: { orderId: claimedOrder._id },
      });
      return;
    }

    const triedState = await getTriedProviderState(claimedOrder._id);
    await DispatchService.dispatchOrder(
      orderId,
      ctx,
      triedState.triedProviderIds,
    );
  },

  /**
   * Tìm provider phù hợp và lần lượt gửi assignment cho từng provider.
   */
  async dispatchOrder(
    orderId: string,
    ctx: DispatchContext,
    triedProviderIds: Types.ObjectId[] = [],
  ): Promise<void> {
    const {
      maxMatchingAttempts,
      matchingProviderTimeoutSeconds,
      maxMatchingDurationSeconds,
      matchingBatchSize,
    } = await getMatchingConfig();
    const order = await Order.findById(orderId).select(
      "status createdAt matchingStartedAt reassignment",
    );
    if (!order || order.status !== "created") return;
    const hasPendingAssignment = await OrderAssignment.exists({
      orderId: order._id,
      status: "pending",
      isDeleted: false,
    });
    if (hasPendingAssignment) return;

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

    const isDirectReplacement = order.reassignment?.status === "matching";
    const maxAttempts = isDirectReplacement
      ? MAX_DIRECT_PROVIDER_ATTEMPTS
      : maxMatchingAttempts;
    if (triedProviderIds.length >= maxAttempts) {
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

    const candidateLimit = isDirectReplacement
      ? 1
      : Math.min(
        matchingBatchSize,
        maxAttempts - triedProviderIds.length,
      );
    const batchNumber = Math.floor(triedProviderIds.length / matchingBatchSize) + 1;

    const isScheduledDispatch = Boolean(ctx.scheduledDates?.length);
    const matchingOptions = {
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      serviceId: ctx.serviceId,
      province: ctx.province,
      ward: ctx.ward,
      excludeProviderIds: triedProviderIds,
      limit: candidateLimit,
      scheduledDates: ctx.scheduledDates,
      scheduleIntervals: ctx.scheduleIntervals,
    };

    // Lịch hẹn ưu tiên provider đang online để khách không phải chờ lâu.
    // Chỉ mở rộng sang provider offline khi hiện không có provider online phù hợp.
    let candidates: ProviderCandidate[] = await MatchingService.findNearestProviders({
      ...matchingOptions,
      requireOnline: true,
    });
    if (isScheduledDispatch && candidates.length === 0) {
      candidates = await MatchingService.findNearestProviders({
        ...matchingOptions,
        requireOnline: false,
      });
    }

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
        ).catch((error: unknown) =>
          dispatchLogger.error("Thử lại matching thất bại.", error, { orderId }),
        );
      }, retryDelayMs);
      retryTimer.unref();
      return;
    }

    const deadline = new Date(
      Math.min(
        Date.now() + (isDirectReplacement
          ? DIRECT_PROVIDER_RESPONSE_TIMEOUT_MS
          : matchingProviderTimeoutSeconds * 1000),
        matchingDeadline.getTime(),
      ),
    );

    await sendAssignmentBatch(
      orderId,
      candidates,
      ctx,
      batchNumber,
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

    if (assignment.assignmentType === "appointment" && order.preferredProviderId) {
      const { requestDirectProviderReassignment } = await import("./orderReassignment.service");
      await requestDirectProviderReassignment(
        orderId,
        timedOutProviderId,
        "Provider không phản hồi yêu cầu lịch hẹn trong 2 phút.",
      );
      return;
    }

    if (assignment.assignmentType === "appointment") {
      const isPreferredProviderRequest = Boolean(order.preferredProviderId);
      if (isPreferredProviderRequest && order.recurringGroupId) {
        await Order.updateMany(
          { recurringGroupId: order.recurringGroupId, status: "created" },
          {
            $set: {
              bookingStatus: "rejected",
              preferredProviderId: null,
            },
          },
          { runValidators: true },
        );
      } else if (isPreferredProviderRequest) {
        order.bookingStatus = "rejected";
        order.preferredProviderId = null;
        await order.save();
      }
      if (isPreferredProviderRequest) {
        await createNotificationRecord({
          userId: order.customerId,
          type: "ORDER",
          title: "Yêu cầu lịch hẹn đã hết hạn",
          content: `Chuyên gia chưa phản hồi đơn ${order.orderCode}. Vui lòng chọn chuyên gia khác.`,
          data: { orderId: order._id },
        });
        return;
      }
    }

    if (assignment.assignmentType === "direct_request") {
      await Order.updateOne(
        { _id: order._id, status: "created" },
        {
          $set: {
            bookingStatus: "rejected",
            preferredProviderId: null,
            readyForMatching: false,
            matchingStartedAt: null,
          },
        },
        { runValidators: true },
      );
      await createNotificationRecord({
        userId: order.customerId,
        type: "ORDER",
        title: "Yêu cầu trực tiếp đã hết hạn",
        content: `Provider chưa phản hồi đơn ${order.orderCode}. Vui lòng chọn provider khác.`,
        data: { orderId: order._id },
      });
      return;
    }

    const hasPendingAssignment = await OrderAssignment.exists({
      orderId: assignment.orderId,
      status: "pending",
      isDeleted: false,
    });
    if (hasPendingAssignment) return;

    const triedState = await getTriedProviderState(assignment.orderId);

    await DispatchService.dispatchOrder(
      orderId,
      ctx,
      triedState.triedProviderIds,
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
      } = await getMatchingConfig();
      const now = new Date();
      const overdueHours = Math.max(await getNumberConfigValue("OVERDUE_ORDER_ESCALATION_HOURS", 24), 1);
      const overdueOrders = await Order.find({
        status: "in_progress",
        isDeleted: false,
        "overdueReview.escalatedAt": null,
        createdAt: { $lte: new Date(now.getTime() - overdueHours * 60 * 60 * 1000) },
      }).select("_id orderCode customerId providerId").limit(100);
      for (const order of overdueOrders) {
        const claimed = await Order.findOneAndUpdate(
          { _id: order._id, status: "in_progress", "overdueReview.escalatedAt": null },
          { $set: { "overdueReview.escalatedAt": now } },
          { returnDocument: "after", runValidators: true },
        );
        if (!claimed || !order.providerId) continue;
        const message = `Đơn ${order.orderCode} đang thực hiện quá ${overdueHours} giờ và cần được xác nhận tình trạng.`;
        await Promise.all([
          createNotificationRecord({ userId: order.customerId, type: "ORDER", title: "Đơn hàng quá hạn cần xác nhận", content: message, data: { orderId: order._id, overdueReview: true } }, { emitRealtime: true }),
          Provider.findById(order.providerId).select("userId").lean().then((provider) => provider && createNotificationRecord({ userId: provider.userId, type: "ORDER", title: "Cần cập nhật đơn đang thực hiện", content: message, data: { orderId: order._id, overdueReview: true } }, { emitRealtime: true })),
        ]);
        const admins = await User.find({ role: "ADMIN", isDeleted: false, status: "active" }).select("_id").lean();
        await Promise.all(admins.map((admin) => createNotificationRecord({ userId: admin._id, type: "ORDER", title: "Đơn quá hạn cần quản trị xử lý", content: message, data: { orderId: order._id, overdueReview: true } }, { emitRealtime: true })));
      }
      const recurringPaymentsToOpen = await Order.find({
        orderType: "recurring",
        status: { $in: ["created", "accepted"] },
        bookingStatus: "reserved",
        scheduledAt: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      })
        .select("_id customerId orderCode scheduledAt")
        .limit(100);

      for (const recurringOrder of recurringPaymentsToOpen) {
        if (!recurringOrder.scheduledAt) continue;
        const paymentDueAt = new Date(
          Math.min(
            now.getTime() + 12 * 60 * 60 * 1000,
            recurringOrder.scheduledAt.getTime(),
          ),
        );
        const openedOrder = await Order.findOneAndUpdate(
          { _id: recurringOrder._id, bookingStatus: "reserved" },
          { $set: { bookingStatus: "awaiting_payment", paymentDueAt } },
          { returnDocument: "after", runValidators: true },
        );
        if (!openedOrder) continue;
        await createNotificationRecord({
          userId: openedOrder.customerId,
          type: "PAYMENT",
          title: "Đến hạn thanh toán buổi định kỳ",
          content: `Vui lòng thanh toán đơn ${openedOrder.orderCode} để giữ lịch sắp tới.`,
          data: { orderId: openedOrder._id, paymentDueAt },
        });
      }

      const expiredPaymentOrders = await Order.find({
        status: { $in: ["created", "accepted"] },
        bookingStatus: "awaiting_payment",
        paymentDueAt: { $lte: now },
      })
        .select("_id recurringGroupId occurrenceNumber")
        .limit(100)
        .lean();

      for (const order of expiredPaymentOrders) {
        try {
          const reconciliation = await reconcilePayosPaymentForExpiration(
            order._id.toString(),
          );
          if (reconciliation.order?.bookingStatus !== "awaiting_payment") {
            continue;
          }
        } catch (error: unknown) {
          dispatchLogger.error(
            "Tạm hoãn hủy lịch vì chưa thể đối soát PayOS.",
            error,
            { orderId: order._id.toString() },
          );
          continue;
        }

        const expirationResult = await Order.updateOne(
          {
            _id: order._id,
            bookingStatus: "awaiting_payment",
            paymentStatus: { $nin: ["paid", "partially_paid"] },
          },
          { $set: { bookingStatus: "expired" } },
        );
        if (expirationResult.modifiedCount === 0) continue;
        await cancelSystemOrderWithSettlement(
          order._id.toString(),
          "Đã hết thời hạn thanh toán giữ lịch.",
          "payment_timeout",
        );
        if (order.recurringGroupId && order.occurrenceNumber === 1) {
          const reservations = await Order.find({ recurringGroupId: order.recurringGroupId, status: "accepted", bookingStatus: "reserved", paymentStatus: "unpaid", isDeleted: false }).select("_id");
          for (const reservation of reservations) {
            await cancelSystemOrderWithSettlement(reservation._id.toString(), "Giải phóng lịch định kỳ vì buổi đầu hết hạn thanh toán.", "payment_timeout");
          }
        }
      }

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

        await DispatchService._onAssignmentTimeout(
          assignment.orderId.toString(),
          assignment._id.toString(),
          assignment.providerId,
          ctx,
        );
      }

      const expiredOrders = await Order.find({
        status: "created",
        preferredProviderId: null,
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
          .select("_id preferredProviderId")
          .limit(100)
          .lean();

        for (const order of activeOrders) {
          const hasPendingAssignment = await OrderAssignment.exists({
            orderId: order._id,
            status: "pending",
          });
          if (hasPendingAssignment) continue;

          if (order.preferredProviderId) {
            await Order.updateOne(
              { _id: order._id, status: "created" },
              { $set: { matchingStartedAt: null } },
              { runValidators: true },
            );
            await DispatchService.dispatchReadyOrder(order._id.toString());
            continue;
          }

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

  stopTimeoutMonitor(): void {
    if (!timeoutMonitor) return;

    clearInterval(timeoutMonitor);
    timeoutMonitor = null;
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

    const ctx = await getDispatchContext(orderId);
    if (!ctx) {
      throw new AppError("Không thể tạo ngữ cảnh điều phối cho đơn hàng.", 404);
    }
    const triedState = await getTriedProviderState(order._id);

    await DispatchService.dispatchOrder(
      order._id.toString(),
      ctx,
      triedState.triedProviderIds,
    );
  },
};
