import mongoose, { ClientSession, Types } from "mongoose";
import type { RequestUser } from "../middlewares/authContext";
import { Address } from "../models/address.model";
import { AuditLog } from "../models/auditLog.model";
import { Order, type IOrder } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import {
  OrderRescheduleRequest,
  type IOrderRescheduleRequest,
  type RescheduleInitiatorRole,
} from "../models/orderRescheduleRequest.model";
import { Provider } from "../models/provider.model";
import { emitToUser } from "../sockets/socketServer";
import { AppError } from "../utils/appError";
import { isWithinAppointmentHours } from "../utils/bookingPolicy";
import {
  canUseRescheduleQuota,
  getVietnamMonthBounds,
  requiresProviderMonthlyWarning,
} from "../utils/orderReschedule";
import { createNotificationRecord } from "./notification.service";
import { DispatchService } from "./dispatch.service";
import { MatchingService } from "./matching.service";
import {
  assertProviderSchedule,
  getAvailableProviderIds,
  getOrderInterval,
  lockProviderSchedule,
} from "./providerSchedule.service";
import { getBookingPolicy } from "./systemConfig.service";

const RESCHEDULE_WARNING_CODE = "PROVIDER_MONTHLY_RESCHEDULE_THRESHOLD" as const;
const ACTIVE_REASSIGNMENT_STATUSES = ["awaiting_customer", "matching"];

type ActorContext = {
  role: RescheduleInitiatorRole;
  userId: Types.ObjectId;
  providerId: Types.ObjectId | null;
};

type ReschedulePayload = {
  scheduledAt: string;
  reason: string;
  warningAcknowledged?: boolean;
  expectedOrderUpdatedAt?: string;
};

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
  && (error as { code?: unknown }).code === 11000;

const expirePendingRequests = async (orderId?: Types.ObjectId) => {
  const now = new Date();
  const expired = await OrderRescheduleRequest.find({
    ...(orderId ? { orderId } : {}),
    status: "pending",
    expiresAt: { $lte: now },
    isDeleted: false,
  }).select("_id orderId initiatorId").lean();
  for (const item of expired) {
    const claimed = await OrderRescheduleRequest.findOneAndUpdate(
      { _id: item._id, status: "pending", expiresAt: { $lte: now } },
      { $set: { status: "expired", respondedAt: now } },
      { new: true, runValidators: true },
    );
    if (!claimed) continue;
    const order = await Order.findOne({ _id: item.orderId, isDeleted: false });
    if (!order) continue;
    await createNotificationRecord({
      userId: item.initiatorId,
      type: "ORDER",
      title: "Yêu cầu dời lịch đã hết hạn",
      content: `Yêu cầu dời lịch của đơn ${order.orderCode} chưa được phản hồi đúng hạn. Lịch cũ vẫn được giữ nguyên.`,
      data: { orderId: order._id, rescheduleRequestId: item._id },
    });
    await emitOrderUpdated(order);
  }
  return expired.length;
};

// API chi tiết truyền bản ghi lean đã populate; API thao tác truyền ObjectId gốc.
const referenceId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "object" && "_id" in value) {
    return String(value._id);
  }
  return String(value);
};

const resolveActor = async (order: IOrder, actor: RequestUser): Promise<ActorContext> => {
  if (actor.role === "CUSTOMER") {
    if (referenceId(order.customerId) !== actor.id) {
      throw new AppError("Bạn không có quyền dời lịch của đơn này.", 403);
    }
    return { role: "customer", userId: new Types.ObjectId(actor.id), providerId: null };
  }
  if (actor.role === "PROVIDER") {
    const provider = await Provider.findOne({
      userId: actor.id,
      verified: true,
      isDeleted: false,
    }).select("_id");
    if (!provider || provider._id.toString() !== referenceId(order.providerId)) {
      throw new AppError("Chỉ chuyên gia đang phụ trách đơn mới được đề nghị dời lịch.", 403);
    }
    return {
      role: "provider",
      userId: new Types.ObjectId(actor.id),
      providerId: provider._id as Types.ObjectId,
    };
  }
  throw new AppError("Vai trò hiện tại không được phép dời lịch.", 403);
};

const assertOrderCanBeRescheduled = async (
  order: IOrder,
  context: ActorContext,
  proposedScheduledAt: Date,
  expectedOrderUpdatedAt?: string,
) => {
  const policy = await getBookingPolicy();
  const now = new Date();
  if (order.orderType !== "scheduled" || !order.scheduledAt) {
    throw new AppError("Chỉ đơn đặt lịch hẹn mới được dời lịch.", 409);
  }
  if (!['created', 'accepted'].includes(order.status)) {
    throw new AppError("Đơn không còn ở trạng thái có thể dời lịch.", 409);
  }
  if (context.role === "provider" && order.status !== "accepted") {
    throw new AppError("Chuyên gia chỉ được dời lịch của đơn đã nhận.", 409);
  }
  if (order.arrival || order.customerNoShow?.status === "pending") {
    throw new AppError("Không thể dời lịch sau khi chuyên gia đã đến hoặc đang xử lý báo cáo khách vắng mặt.", 409);
  }
  if (order.reassignment && ACTIVE_REASSIGNMENT_STATUSES.includes(order.reassignment.status)) {
    throw new AppError("Vui lòng hoàn tất yêu cầu đổi chuyên gia trước khi dời lịch.", 409);
  }
  if (expectedOrderUpdatedAt && order.updatedAt.getTime() !== Date.parse(expectedOrderUpdatedAt)) {
    throw new AppError("Đơn vừa được cập nhật. Vui lòng tải lại trước khi dời lịch.", 409);
  }
  if (!Number.isFinite(proposedScheduledAt.getTime()) || !isWithinAppointmentHours(proposedScheduledAt)) {
    throw new AppError("Vui lòng chọn giờ hẹn từ 08:00 đến 21:00 theo giờ Việt Nam.", 400);
  }
  const minimumTime = now.getTime() + policy.minAdvanceMinutes * 60_000;
  if (order.scheduledAt.getTime() < minimumTime) {
    throw new AppError(`Chỉ được dời lịch trước giờ hẹn ít nhất ${policy.minAdvanceMinutes} phút.`, 409);
  }
  if (proposedScheduledAt.getTime() < minimumTime) {
    throw new AppError(`Lịch mới phải cách thời điểm hiện tại ít nhất ${policy.minAdvanceMinutes} phút.`, 400);
  }
  if (proposedScheduledAt.getTime() === order.scheduledAt.getTime()) {
    throw new AppError("Lịch mới phải khác lịch hẹn hiện tại.", 400);
  }
  return policy;
};

const getAppliedCountForRole = (orderId: Types.ObjectId, role: RescheduleInitiatorRole, session?: ClientSession) =>
  OrderRescheduleRequest.countDocuments({ orderId, initiatorRole: role, status: "applied", isDeleted: false })
    .session(session ?? null);

const getProviderMonthlyAppliedCount = (providerId: Types.ObjectId, now = new Date(), session?: ClientSession) => {
  const { start, end } = getVietnamMonthBounds(now);
  return OrderRescheduleRequest.countDocuments({
    initiatorProviderId: providerId,
    status: "applied",
    requestedAt: { $gte: start, $lt: end },
    isDeleted: false,
  }).session(session ?? null);
};

const proposedOrder = (order: IOrder, scheduledAt: Date) => {
  const copy = new Order(order.toObject());
  copy._id = order._id;
  copy.scheduledAt = scheduledAt;
  const durationMinutes = order.schedule?.durationMinutes ?? 60;
  copy.schedule = {
    durationMinutes,
    bufferMinutes: order.schedule?.bufferMinutes ?? 0,
    travelMinutes: order.schedule?.travelMinutes ?? 0,
    expectedStartAt: scheduledAt,
    expectedEndAt: new Date(scheduledAt.getTime() + durationMinutes * 60_000),
  };
  return copy;
};

const assertProposedAvailability = async (order: IOrder, scheduledAt: Date) => {
  const policy = await getBookingPolicy();
  const proposed = proposedOrder(order, scheduledAt);
  if (order.providerId) {
    const available = await getAvailableProviderIds(
      [order.providerId as Types.ObjectId],
      [getOrderInterval(proposed, policy)],
      { policy, excludeOrderIds: [order._id as Types.ObjectId] },
    );
    if (!available.has(order.providerId.toString())) {
      throw new AppError("Chuyên gia không còn trống trong thời gian đã chọn.", 409);
    }
    return;
  }
  const address = order.addressSnapshot ?? await Address.findById(order.addressId).select("latitude longitude province ward");
  if (!address) throw new AppError("Địa chỉ thực hiện không còn khả dụng.", 409);
  const interval = getOrderInterval(proposed, policy);
  const candidates = await MatchingService.findNearestProviders({
    latitude: address.latitude,
    longitude: address.longitude,
    serviceId: order.serviceId.toString(),
    province: address.province,
    ward: address.ward,
    limit: 1,
    requireOnline: true,
    scheduledDates: [scheduledAt],
    scheduleIntervals: [interval],
  });
  if (!candidates.length) {
    throw new AppError("Chưa có chuyên gia phù hợp và còn trống trong thời gian đã chọn.", 409);
  }
};

const getCounterpartyUserId = async (order: IOrder, initiatorRole: RescheduleInitiatorRole) => {
  if (initiatorRole === "provider") return order.customerId.toString();
  if (!order.providerId) return null;
  const provider = await Provider.findById(order.providerId).select("userId").lean();
  return provider?.userId.toString() ?? null;
};

const emitOrderUpdated = async (order: IOrder) => {
  emitToUser(order.customerId.toString(), "order:updated", { orderId: order._id.toString() });
  if (!order.providerId) return;
  const provider = await Provider.findById(order.providerId).select("userId").lean();
  if (provider) emitToUser(provider.userId.toString(), "order:updated", { orderId: order._id.toString() });
};

export const previewOrderReschedule = async (orderId: string, actor: RequestUser, scheduledAt: Date) => {
  if (!Types.ObjectId.isValid(orderId)) throw new AppError("Đơn hàng không hợp lệ.", 400);
  const order = await Order.findOne({ _id: orderId, isDeleted: false });
  if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
  await expirePendingRequests(order._id as Types.ObjectId);
  const context = await resolveActor(order, actor);
  const policy = await assertOrderCanBeRescheduled(order, context, scheduledAt);
  const [appliedCount, pendingRequest, monthlyAppliedCount] = await Promise.all([
    getAppliedCountForRole(order._id as Types.ObjectId, context.role),
    OrderRescheduleRequest.findOne({ orderId: order._id, status: "pending", isDeleted: false }).lean(),
    context.providerId ? getProviderMonthlyAppliedCount(context.providerId) : Promise.resolve(0),
  ]);
  if (!canUseRescheduleQuota(appliedCount)) throw new AppError(`Phía ${context.role === "provider" ? "chuyên gia" : "khách hàng"} đã sử dụng lượt dời lịch cho đơn này.`, 409);
  if (pendingRequest) throw new AppError("Đơn đang có một yêu cầu dời lịch chờ phản hồi.", 409);
  await assertProposedAvailability(order, scheduledAt);
  const warningRequired = context.role === "provider"
    && requiresProviderMonthlyWarning(monthlyAppliedCount, policy.providerMonthlyRescheduleWarningThreshold);
  return {
    currentScheduledAt: order.scheduledAt,
    proposedScheduledAt: scheduledAt,
    approvalRequired: Boolean(order.providerId),
    approvalRole: order.providerId ? (context.role === "customer" ? "provider" : "customer") : null,
    remainingReschedulesForRole: 1,
    minAdvanceMinutes: policy.minAdvanceMinutes,
    responseMinutes: policy.rescheduleResponseMinutes,
    providerMonthlyAppliedCount: context.role === "provider" ? monthlyAppliedCount : null,
    warningRequired,
    warningCode: warningRequired ? RESCHEDULE_WARNING_CODE : null,
  };
};

export const createOrderRescheduleRequest = async (orderId: string, actor: RequestUser, payload: ReschedulePayload) => {
  const proposedScheduledAt = new Date(payload.scheduledAt);
  const preview = await previewOrderReschedule(orderId, actor, proposedScheduledAt);
  if (preview.warningRequired && payload.warningAcknowledged !== true) {
    throw new AppError("Vui lòng xác nhận cảnh báo dời lịch nhiều lần trong tháng trước khi tiếp tục.", 400);
  }
  const order = await Order.findOne({ _id: orderId, isDeleted: false });
  if (!order || !order.scheduledAt) throw new AppError("Đơn hàng không còn khả dụng để dời lịch.", 409);
  const context = await resolveActor(order, actor);
  await assertOrderCanBeRescheduled(order, context, proposedScheduledAt, payload.expectedOrderUpdatedAt);
  if (!canUseRescheduleQuota(await getAppliedCountForRole(order._id as Types.ObjectId, context.role))) {
    throw new AppError(`Phía ${context.role === "provider" ? "chuyên gia" : "khách hàng"} đã sử dụng lượt dời lịch cho đơn này.`, 409);
  }
  const requestedAt = new Date();
  const requestData = {
    orderId: order._id,
    initiatorId: context.userId,
    initiatorRole: context.role,
    initiatorProviderId: context.providerId,
    approvalRole: preview.approvalRole as RescheduleInitiatorRole | null,
    oldScheduledAt: order.scheduledAt,
    proposedScheduledAt,
    reason: payload.reason,
    warningCode: preview.warningCode,
    warningAcknowledged: payload.warningAcknowledged === true,
    monthlyAppliedCountAtRequest: preview.providerMonthlyAppliedCount,
    requestedAt,
  } as const;

  if (order.providerId) {
    try {
      const request = new OrderRescheduleRequest({
        ...requestData,
        status: "pending",
        expiresAt: new Date(requestedAt.getTime() + preview.responseMinutes * 60_000),
      });
      await request.save();
      const counterpartyId = await getCounterpartyUserId(order, context.role);
      if (counterpartyId) {
        await createNotificationRecord({
          userId: counterpartyId,
          type: "ORDER",
          title: context.role === "provider" ? "Chuyên gia đề nghị dời lịch" : "Khách hàng đề nghị dời lịch",
          content: `Đơn ${order.orderCode} được đề nghị chuyển sang ${proposedScheduledAt.toLocaleString("vi-VN")}.`,
          data: { orderId: order._id, rescheduleRequestId: request._id },
        });
      }
      await emitOrderUpdated(order);
      return request;
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AppError("Đơn đang có một yêu cầu dời lịch chờ phản hồi.", 409);
      throw error;
    }
  }

  const session = await mongoose.startSession();
  let closedAssignments: Array<{ _id: Types.ObjectId; providerId: Types.ObjectId }> = [];
  let transactionResult: { order: IOrder; request: IOrderRescheduleRequest } | null = null;
  try {
    transactionResult = await session.withTransaction(async () => {
      const current = await Order.findOne({
        _id: order._id,
        customerId: context.userId,
        providerId: null,
        orderType: "scheduled",
        status: "created",
        isDeleted: false,
        updatedAt: order.updatedAt,
      }).session(session);
      if (!current || !current.scheduledAt) throw new AppError("Đơn vừa được cập nhật. Vui lòng tải lại và thử lại.", 409);
      if (!canUseRescheduleQuota(await getAppliedCountForRole(current._id as Types.ObjectId, context.role, session))) {
        throw new AppError("Bạn đã sử dụng lượt dời lịch cho đơn này.", 409);
      }
      closedAssignments = await OrderAssignment.find({ orderId: current._id, status: "pending", isDeleted: false })
        .select("_id providerId").session(session).lean();
      await OrderAssignment.updateMany(
        { _id: { $in: closedAssignments.map((item) => item._id) }, status: "pending" },
        { $set: { status: "cancelled", respondedAt: requestedAt } },
        { session, runValidators: true },
      );
      const next = proposedOrder(current, proposedScheduledAt);
      current.scheduledAt = proposedScheduledAt;
      current.schedule = next.schedule;
      const canResumeMatching = current.readyForMatching || ["paid", "partially_paid"].includes(current.paymentStatus);
      current.readyForMatching = canResumeMatching;
      current.matchingStartedAt = null;
      current.matchingSearch = null;
      if (canResumeMatching) current.bookingStatus = "awaiting_provider";
      await current.save({ session });
      const appliedRequest = new OrderRescheduleRequest({
        ...requestData,
        approvalRole: null,
        status: "applied",
        expiresAt: null,
        appliedAt: requestedAt,
      });
      await appliedRequest.save({ session });
      await AuditLog.create([{
        actorId: context.userId,
        actorRole: context.role,
        action: "RESCHEDULE_ORDER",
        targetType: "Order",
        targetId: current._id,
        oldValue: { scheduledAt: requestData.oldScheduledAt },
        newValue: { scheduledAt: proposedScheduledAt },
        description: "Khách hàng dời lịch khi đơn chưa có chuyên gia nhận.",
      }], { session });
      return { order: current, request: appliedRequest };
    });
  } finally {
    await session.endSession();
  }
  if (!transactionResult) throw new AppError("Không thể áp dụng lịch mới.", 409);
  const { order: updatedOrder, request } = transactionResult;
  const providers = await Provider.find({ _id: { $in: closedAssignments.map((item) => item.providerId) } }).select("_id userId").lean();
  const userByProvider = new Map(providers.map((provider) => [provider._id.toString(), provider.userId.toString()]));
  for (const assignment of closedAssignments) {
    const providerUserId = userByProvider.get(assignment.providerId.toString());
    if (providerUserId) emitToUser(providerUserId, "assignment:closed", { assignmentId: assignment._id.toString(), reason: "rescheduled" });
  }
  await emitOrderUpdated(updatedOrder);
  if (updatedOrder.readyForMatching) void DispatchService.dispatchReadyOrder(updatedOrder._id.toString());
  return request;
};

export const respondOrderRescheduleRequest = async (
  orderId: string,
  requestId: string,
  actor: RequestUser,
  payload: { decision: "accept" | "reject"; reason?: string; expectedOrderUpdatedAt?: string },
) => {
  if (!Types.ObjectId.isValid(orderId) || !Types.ObjectId.isValid(requestId)) throw new AppError("Yêu cầu dời lịch không hợp lệ.", 400);
  await expirePendingRequests(new Types.ObjectId(orderId));
  const request = await OrderRescheduleRequest.findOne({ _id: requestId, orderId, status: "pending", isDeleted: false });
  if (!request) throw new AppError("Yêu cầu dời lịch không còn chờ phản hồi.", 409);
  const order = await Order.findOne({ _id: orderId, isDeleted: false });
  if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
  const responder = await resolveActor(order, actor);
  if (request.approvalRole !== responder.role || request.initiatorId.toString() === actor.id) {
    throw new AppError("Bạn không có quyền phản hồi yêu cầu dời lịch này.", 403);
  }
  if (payload.decision === "reject") {
    request.status = "rejected";
    request.respondedBy = responder.userId;
    request.responseReason = payload.reason ?? null;
    request.respondedAt = new Date();
    await request.save();
    await createNotificationRecord({
      userId: request.initiatorId,
      type: "ORDER",
      title: "Yêu cầu dời lịch đã bị từ chối",
      content: `Lịch hẹn của đơn ${order.orderCode} được giữ nguyên.${payload.reason ? ` Lý do: ${payload.reason}` : ""}`,
      data: { orderId: order._id, rescheduleRequestId: request._id },
    });
    await emitOrderUpdated(order);
    return request;
  }

  const policy = await assertOrderCanBeRescheduled(order, {
    role: request.initiatorRole,
    userId: request.initiatorId,
    providerId: request.initiatorProviderId ?? null,
  }, request.proposedScheduledAt, payload.expectedOrderUpdatedAt);
  const session = await mongoose.startSession();
  let appliedRequest: IOrderRescheduleRequest | null = null;
  let updatedOrder: IOrder | null = null;
  try {
    await session.withTransaction(async () => {
      const currentRequest = await OrderRescheduleRequest.findOne({ _id: request._id, status: "pending", isDeleted: false }).session(session);
      const current = await Order.findOne({ _id: order._id, status: { $in: ["created", "accepted"] }, isDeleted: false }).session(session);
      if (!currentRequest || !current || !current.scheduledAt || current.scheduledAt.getTime() !== currentRequest.oldScheduledAt.getTime()) {
        throw new AppError("Lịch hẹn vừa thay đổi. Yêu cầu này không còn hợp lệ.", 409);
      }
      if (!canUseRescheduleQuota(await getAppliedCountForRole(current._id as Types.ObjectId, currentRequest.initiatorRole, session))) {
        throw new AppError("Phía yêu cầu đã sử dụng lượt dời lịch cho đơn này.", 409);
      }
      if (!current.providerId) throw new AppError("Đơn không còn chuyên gia phụ trách để xác nhận lịch mới.", 409);
      await lockProviderSchedule(current.providerId as Types.ObjectId, session);
      const next = proposedOrder(current, currentRequest.proposedScheduledAt);
      await assertProviderSchedule(current.providerId as Types.ObjectId, [next], session, policy);
      current.scheduledAt = currentRequest.proposedScheduledAt;
      current.schedule = next.schedule;
      await current.save({ session });
      currentRequest.status = "applied";
      currentRequest.respondedBy = responder.userId;
      currentRequest.responseReason = payload.reason ?? null;
      currentRequest.respondedAt = new Date();
      currentRequest.appliedAt = currentRequest.respondedAt;
      await currentRequest.save({ session });
      await AuditLog.create([{
        actorId: responder.userId,
        actorRole: responder.role,
        action: "APPROVE_ORDER_RESCHEDULE",
        targetType: "Order",
        targetId: current._id,
        oldValue: { scheduledAt: currentRequest.oldScheduledAt },
        newValue: { scheduledAt: currentRequest.proposedScheduledAt },
        description: "Bên còn lại chấp thuận yêu cầu dời lịch.",
      }], { session });
      appliedRequest = currentRequest;
      updatedOrder = current;
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 409) {
      await OrderRescheduleRequest.updateOne(
        { _id: request._id, status: "pending" },
        { $set: { status: "conflicted", respondedAt: new Date(), responseReason: error.message } },
        { runValidators: true },
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
  if (!appliedRequest || !updatedOrder) throw new AppError("Không thể áp dụng lịch mới.", 409);
  await createNotificationRecord({
    userId: request.initiatorId,
    type: "ORDER",
    title: "Yêu cầu dời lịch đã được chấp thuận",
    content: `Đơn ${order.orderCode} đã chuyển sang ${request.proposedScheduledAt.toLocaleString("vi-VN")}.`,
    data: { orderId: order._id, rescheduleRequestId: request._id },
  });
  await emitOrderUpdated(updatedOrder);
  return appliedRequest;
};

export const cancelOrderRescheduleRequest = async (orderId: string, requestId: string, actor: RequestUser) => {
  const request = await OrderRescheduleRequest.findOne({ _id: requestId, orderId, status: "pending", isDeleted: false });
  if (!request) throw new AppError("Yêu cầu dời lịch không còn có thể thu hồi.", 409);
  if (request.initiatorId.toString() !== actor.id) throw new AppError("Chỉ người tạo yêu cầu mới được thu hồi.", 403);
  request.status = "cancelled";
  request.respondedAt = new Date();
  request.respondedBy = new Types.ObjectId(actor.id);
  await request.save();
  const order = await Order.findById(orderId);
  if (order) await emitOrderUpdated(order);
  return request;
};

export const getOrderRescheduleContext = async (order: IOrder, actor: RequestUser) => {
  await expirePendingRequests(order._id as Types.ObjectId);
  const context = await resolveActor(order, actor);
  const policy = await getBookingPolicy();
  const [latestRequest, appliedCount, monthlyAppliedCount] = await Promise.all([
    OrderRescheduleRequest.findOne({ orderId: order._id, isDeleted: false }).sort({ createdAt: -1 }).lean(),
    getAppliedCountForRole(order._id as Types.ObjectId, context.role),
    context.providerId ? getProviderMonthlyAppliedCount(context.providerId) : Promise.resolve(0),
  ]);
  const structurallyAllowed = order.orderType === "scheduled" && Boolean(order.scheduledAt)
    && ["created", "accepted"].includes(order.status)
    && (context.role !== "provider" || order.status === "accepted")
    && !order.arrival && order.customerNoShow?.status !== "pending"
    && !(order.reassignment && ACTIVE_REASSIGNMENT_STATUSES.includes(order.reassignment.status));
  return {
    latestRescheduleRequest: latestRequest ?? null,
    rescheduleEligibility: {
      canRequest: structurallyAllowed && appliedCount < 1 && latestRequest?.status !== "pending",
      appliedCount,
      remainingCount: appliedCount >= 1 ? 0 : 1,
      minAdvanceMinutes: policy.minAdvanceMinutes,
      responseMinutes: policy.rescheduleResponseMinutes,
      providerMonthlyAppliedCount: context.role === "provider" ? monthlyAppliedCount : null,
      warningThreshold: context.role === "provider" ? policy.providerMonthlyRescheduleWarningThreshold : null,
    },
  };
};

let expirationMonitor: ReturnType<typeof setInterval> | null = null;

export const startOrderRescheduleMonitor = () => {
  if (expirationMonitor) return;
  expirationMonitor = setInterval(() => { void expirePendingRequests(); }, 60_000);
  expirationMonitor.unref();
};

export const stopOrderRescheduleMonitor = () => {
  if (expirationMonitor) clearInterval(expirationMonitor);
  expirationMonitor = null;
};
