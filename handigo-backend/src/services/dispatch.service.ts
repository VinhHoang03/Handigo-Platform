import { Types } from "mongoose";
import { buildMatchingSearch, getMatchingSearchStage, getProviderResponseTimeoutSeconds } from "../utils/matchingSearch";

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
import { findOverdueOrders } from "./orderOverdue.service";
import { isRetryableWriteConflict } from "../utils/transaction";

async function createMatchingSearch(startedAt: Date) {
  const [initial, expanded, delay, duration] = await Promise.all([
    getNumberConfigValue("INITIAL_PROVIDER_RADIUS_KM", 5),
    getNumberConfigValue("MAX_PROVIDER_RADIUS_KM", 10),
    getNumberConfigValue("MATCHING_EXPAND_AFTER_MINUTES", 1),
    getNumberConfigValue("MATCHING_EXPANDED_DURATION_MINUTES", 3),
  ]);
  return buildMatchingSearch(startedAt, Math.max(initial, 0.1),
    Math.max(expanded, initial, 0.1), Math.max(delay, 0.1), Math.max(duration, 0.1));
}
/** Số giây một provider có thể phản hồi trước khi chuyển sang provider tiếp theo. */
const DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS = 60;

/** Số provider nhận cùng một lượt đề nghị để cạnh tranh nhận đơn. */
const DEFAULT_MATCHING_BATCH_SIZE = 3;

/** Đọc thời gian nhận đơn do admin cấu hình cho mọi loại đề nghị mới. */
export const getProviderResponseTimeoutMs = async () => {
  const [responseSeconds, expandAfterMinutes] = await Promise.all([
    getNumberConfigValue("MATCHING_PROVIDER_TIMEOUT_SECONDS", DEFAULT_MATCHING_PROVIDER_TIMEOUT_SECONDS),
    getNumberConfigValue("MATCHING_EXPAND_AFTER_MINUTES", 1),
  ]);
  return getProviderResponseTimeoutSeconds(responseSeconds, expandAfterMinutes) * 1000;
};

/** Số provider tối đa được thử sau khi khách đồng ý tìm provider thay thế. */
export const MAX_DIRECT_PROVIDER_ATTEMPTS = 3;

/** Số lượt matching tối đa trước khi hủy đơn. */
const DEFAULT_MAX_MATCHING_ATTEMPTS = 5;

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
    providerResponseTimeoutMs,
    maxMatchingAttemptsValue,
    scheduledDispatchLeadMinutesValue,
    matchingBatchSizeValue,
  ] = await Promise.all([
    getProviderResponseTimeoutMs(),
    getNumberConfigValue(
      "MAX_MATCHING_ATTEMPTS",
      DEFAULT_MAX_MATCHING_ATTEMPTS,
    ),
    getNumberConfigValue(
      "SCHEDULED_DISPATCH_LEAD_MINUTES",
      DEFAULT_SCHEDULED_DISPATCH_LEAD_MINUTES,
    ),
    getNumberConfigValue("MATCHING_BATCH_SIZE", DEFAULT_MATCHING_BATCH_SIZE),
  ]);

  return {
    matchingProviderTimeoutSeconds: providerResponseTimeoutMs / 1000,
    maxMatchingAttempts: Math.max(
      Math.floor(maxMatchingAttemptsValue),
      1,
    ),
    scheduledDispatchLeadMinutes: Math.max(
      scheduledDispatchLeadMinutesValue,
      0,
    ),
    matchingBatchSize: Math.max(Math.floor(matchingBatchSizeValue), 1),
  };
}

export async function getMaxMatchingDurationSeconds(): Promise<number> {
  const startedAt = new Date();
  const search = await createMatchingSearch(startedAt);
  return (search.expiresAt.getTime() - startedAt.getTime()) / 1000;
}

const pendingUnmatchedCancellations = new Map<string, Promise<boolean>>();

async function cancelUnmatchedOrder(orderId: string, reason: string) {
  const pending = pendingUnmatchedCancellations.get(orderId);
  if (pending) return pending;

  // Timer và bộ quét có thể cùng hết hạn một đơn; chỉ chạy một lần hủy trong tiến trình.
  const task = (async () => {
    const order = await Order.findById(orderId).select("status");
    if (!order || order.status !== "created") return false;

    try {
      await cancelSystemOrderWithSettlement(orderId, reason, "provider_unavailable");
      return true;
    } catch (error) {
      if (!isRetryableWriteConflict(error)) throw error;
      const current = await Order.findById(orderId).select("status readyForMatching");
      // Không che lỗi quyết toán sau khi hủy; chỉ hoãn đơn còn trong hàng đợi điều phối.
      if (!current || current.status !== "created" || !current.readyForMatching) throw error;
      dispatchLogger.warn("Tạm hoãn hủy đơn do xung đột ghi; sẽ thử lại ở lượt quét tiếp theo.", { orderId });
      return false;
    }
  })();
  pendingUnmatchedCancellations.set(orderId, task);
  try { return await task; }
  finally {
    if (pendingUnmatchedCancellations.get(orderId) === task) pendingUnmatchedCancellations.delete(orderId);
  }
}

async function getDispatchContext(
  orderId: string,
): Promise<DispatchContext | null> {
  const order = await Order.findById(orderId);
  if (!order) return null;

  const address = order.addressSnapshot ?? await Address.findById(order.addressId).select(
    "latitude longitude province ward",
  );
  if (!address) return null;

  const scheduledDates = order.scheduledAt ? [order.scheduledAt] : [];
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
    .select("reassignment matchingStartedAt")
    .lean();
  const isReassignment = order?.reassignment?.status === "matching";
  const triedAssignments = await OrderAssignment.find({
    orderId,
    status: { $in: ["rejected", "timeout"] },
    ...(isReassignment && order.reassignment?.respondedAt
      ? { assignedAt: { $gte: order.reassignment.respondedAt } }
      : order?.matchingStartedAt ? { assignedAt: { $gte: order.matchingStartedAt } } : {}),
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
  reuseClosedAssignments = false,
) {
  const isAppointment = Boolean(ctx.scheduledDates?.length);
  const assignedAt = new Date();
  const createAssignment = async (candidate: ProviderCandidate) => {
    const data = {
      orderId: new Types.ObjectId(orderId),
      providerId: candidate.providerId,
      assignmentType: isAppointment ? "appointment" as const : "dispatch" as const,
      status: "pending" as const,
      assignedAt,
      responseDeadline: deadline,
    };
    if (reuseClosedAssignments) {
      const existing = await OrderAssignment.findOneAndUpdate(
        { orderId: data.orderId, providerId: data.providerId,
          status: { $in: ["cancelled", "rejected", "timeout"] }, isDeleted: false },
        { $set: { ...data, respondedAt: null, rejectReason: null } },
        { new: true, runValidators: true },
      );
      if (existing) return existing;
    }
    return OrderAssignment.create(data);
  };

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
  const data = {
    orderId: new Types.ObjectId(orderId),
    providerId: candidate.providerId,
    assignmentType: ctx.scheduledDates?.length ? "appointment" as const : "direct_request" as const,
    status: "pending" as const,
    assignedAt: new Date(),
    responseDeadline: deadline,
  };
  const assignment = await OrderAssignment.findOneAndUpdate(
    { orderId: data.orderId, providerId: data.providerId,
      status: { $in: ["cancelled", "rejected", "timeout"] }, isDeleted: false },
    { $set: { ...data, respondedAt: null, rejectReason: null } },
    { new: true, runValidators: true },
  ) ?? await OrderAssignment.create(data);

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
   * cho cả đơn đặt ngay và lịch hẹn.
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
      {
        $set: {
          matchingStartedAt,
          matchingSearch: order.preferredProviderId ? null : await createMatchingSearch(matchingStartedAt),
        }
      },
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
        requireOnline: true,
      });
      const preferredCandidate = preferredCandidates[0];
      if (preferredCandidate) {
        const deadline = new Date(
          Date.now() + await getProviderResponseTimeoutMs(),
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
      matchingProviderTimeoutSeconds,
      maxMatchingAttempts,
      matchingBatchSize,
    } = await getMatchingConfig();
    let order = await Order.findById(orderId).select(
      "status readyForMatching preferredProviderId matchingSearch createdAt matchingStartedAt reassignment inspectionRequired",
    );
    if (!order || order.status !== "created" || !order.readyForMatching || order.preferredProviderId) return;
    if (!order.matchingSearch) {
      await Order.updateOne(
        { _id: orderId, status: "created", matchingSearch: null },
        { $set: { matchingSearch: await createMatchingSearch(order.matchingStartedAt || new Date()) } },
        { runValidators: true },
      );
      order = await Order.findById(orderId).select(
        "status readyForMatching preferredProviderId matchingSearch createdAt matchingStartedAt reassignment inspectionRequired",
      );
    }
    if (!order || order.status !== "created" || !order.readyForMatching || order.preferredProviderId || !order.matchingSearch) return;
    const stage = getMatchingSearchStage(order.matchingSearch);
    if (stage.expired) {
      await cancelUnmatchedOrder(orderId,
        `Không tìm thấy thợ phù hợp trong bán kính ${order.matchingSearch.expandedRadiusKm} km sau thời gian tìm kiếm.`);
      return;
    }
    const hasPendingAssignment = await OrderAssignment.exists({
      orderId: order._id,
      status: "pending",
      isDeleted: false,
    });
    if (hasPendingAssignment) return;

    const isAutomaticReplacement = order.reassignment?.status === "matching" && order.reassignment.automatic;
    const matchingDeadline = order.matchingSearch.expiresAt;
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
    if (!isAutomaticReplacement && triedProviderIds.length >= maxAttempts) {
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

    const candidateLimit = isAutomaticReplacement ? matchingBatchSize : isDirectReplacement
      ? 1
      : Math.min(
        matchingBatchSize,
        maxAttempts - triedProviderIds.length,
      );
    const batchNumber = Math.floor(triedProviderIds.length / matchingBatchSize) + 1;

    const matchingOptions = {
      maxDistanceMeters: stage.radiusKm * 1000,
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

    // Mọi loại đơn đều chỉ được điều phối cho provider đang online.
    let candidates: ProviderCandidate[] = await MatchingService.findNearestProviders({
      ...matchingOptions,
      requireOnline: true,
    });
    // Bộ quét định kỳ tìm lại thợ vừa trực tuyến và khôi phục sau khởi động lại.
    if (candidates.length === 0 || stage.deadline.getTime() <= Date.now()) return;

    const deadline = new Date(
      Math.min(
        Date.now() + matchingProviderTimeoutSeconds * 1000,
        stage.deadline.getTime(),
      ),
    );

    await sendAssignmentBatch(
      orderId,
      candidates,
      ctx,
      batchNumber,
      deadline,
      true,
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
      { _id: assignmentId, status: "pending", responseDeadline: { $lte: new Date() } },
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
        "Provider không phản hồi yêu cầu lịch hẹn trong thời hạn nhận đơn.",
      );
      return;
    }

    if (assignment.assignmentType === "appointment") {
      const isPreferredProviderRequest = Boolean(order.preferredProviderId);
      if (isPreferredProviderRequest) {
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

    const scanOnce = async (recoverStalledOrders = false) => {
      const now = new Date();
      const overdueHours = Math.max(await getNumberConfigValue("OVERDUE_ORDER_ESCALATION_HOURS", 24), 1);
      const overdueOrders = await findOverdueOrders(now, overdueHours);
      for (const order of overdueOrders) {
        const claimed = await Order.findOneAndUpdate(
          { _id: order._id, status: "in_progress", isDeleted: false, updatedAt: order.updatedAt, "overdueReview.escalatedAt": null },
          // Trường cha có default null nên phải khởi tạo object thay vì ghi vào đường dẫn con.
          { $set: { overdueReview: { escalatedAt: now } } },
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
      const expiredPaymentOrders = await Order.find({
        status: { $in: ["created", "accepted"] },
        bookingStatus: "awaiting_payment",
        paymentDueAt: { $lte: now },
      })
        .select("_id")
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

      {
        const activeOrders = await Order.find({
          status: "created",
          readyForMatching: true,
          matchingStartedAt: { $ne: null },
        })
          .select("_id preferredProviderId")
          .lean();

        for (const order of activeOrders) {
          try {
            const hasPendingAssignment = await OrderAssignment.exists({
              orderId: order._id,
              status: "pending",
            });
            if (hasPendingAssignment) continue;

            if (order.preferredProviderId) {
              if (!recoverStalledOrders) continue;
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
            dispatchLogger.debug("Kiểm tra lại đơn đang chờ thợ.", {
              orderId: order._id.toString(),
              attemptNumber: triedState.attemptNumber,
            });
            await DispatchService.dispatchOrder(
              order._id.toString(),
              ctx,
              triedState.triedProviderIds,
            );
          } catch (error: unknown) {
            dispatchLogger.error("Không thể xử lý đơn trong lượt quét điều phối.", error, {
              orderId: order._id.toString(),
            });
          }
        }
      }
    };

    let scanning = false;
    const scan = async (recoverStalledOrders = false) => {
      if (scanning) return;
      scanning = true;
      try { await scanOnce(recoverStalledOrders); }
      finally { scanning = false; }
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

/** Danh sách bản đồ dùng cùng tiêu chí điều phối, chỉ dành cho chủ đơn đang tìm thợ. */
export async function getMatchingMapProviders(orderId: string, customerId: string) {
  const order = await Order.findOne({ _id: orderId, customerId, isDeleted: false });
  if (!order) throw new AppError("Không tìm thấy đơn hàng", 404);
  if (order.status !== "created" || order.providerId || !order.matchingSearch || !order.readyForMatching) {
    return { radiusKm: null, providers: [] };
  }
  const stage = getMatchingSearchStage(order.matchingSearch);
  if (stage.expired) return { radiusKm: stage.radiusKm, providers: [] };
  const ctx = await getDispatchContext(orderId);
  if (!ctx) return { radiusKm: stage.radiusKm, providers: [] };
  const tried = await getTriedProviderState(orderId);
  const candidates = await MatchingService.findNearestProviders({
    ...ctx,
    maxDistanceMeters: stage.radiusKm * 1000,
    limit: Number.MAX_SAFE_INTEGER,
    excludeProviderIds: tried.triedProviderIds,
    requireOnline: true,
  });
  return {
    radiusKm: stage.radiusKm,
    providers: candidates.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
      .map((item) => ({ providerId: item.providerId.toString(), latitude: item.latitude!, longitude: item.longitude!, distanceMeters: item.distanceMeters })),
  };
}
