import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { OrderRescheduleRequest, type IOrderRescheduleRequest } from "../models/orderRescheduleRequest.model";
import type { RequestUser } from "../middlewares/authContext";
import { AppError } from "../utils/appError";
import { createOrderRescheduleRequest, getOrderRescheduleContext, previewOrderReschedule,
  respondOrderRescheduleRequest, cancelOrderRescheduleRequest } from "./orderReschedule.service";

const ownedOrder = async (user: RequestUser, orderId: string) => {
  if (user.role !== "CUSTOMER") throw new AppError("Chỉ khách hàng được dùng trợ lý dời lịch.", 403);
  const order = await Order.findOne({ _id: orderId, customerId: user.id, isDeleted: false });
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  return order;
};
const requestView = (request: IOrderRescheduleRequest) => ({
  requestId: String(request._id), orderId: String(request.orderId), status: request.status,
  currentSchedule: request.oldScheduledAt, schedule: request.proposedScheduledAt,
  initiatorRole: request.initiatorRole, reason: request.reason, responseDeadline: request.expiresAt,
  message: request.status === "applied" ? "Lịch hẹn mới đã được áp dụng."
    : request.status === "pending" ? "Đã gửi đề nghị dời lịch, đang chờ thợ phản hồi. Lịch hẹn cũ vẫn có hiệu lực."
    : request.status === "rejected" ? "Đã từ chối đề nghị dời lịch. Lịch hẹn cũ vẫn có hiệu lực."
    : request.status === "cancelled" ? "Đã thu hồi đề nghị dời lịch. Lịch hẹn cũ vẫn có hiệu lực."
    : "Yêu cầu dời lịch không còn hiệu lực; hãy kiểm tra lịch hiện tại của đơn.",
});
const actionRequestId = (userId: string, actionId: string) =>
  new Types.ObjectId(createHash("sha256").update(`reschedule:${userId}:${actionId}`).digest("hex").slice(0, 24));

export const AgentRescheduleService = {
  async get(user: RequestUser, orderId: string) {
    const order = await ownedOrder(user, orderId);
    const data = await getOrderRescheduleContext(order, user);
    const request = data.latestRescheduleRequest;
    return { orderId, orderCode: order.orderCode, schedule: order.scheduledAt,
      eligibility: data.rescheduleEligibility,
      request: request ? { ...requestView(request as IOrderRescheduleRequest),
        canRespond: request.status === "pending" && request.approvalRole === "customer" && String(request.initiatorId) !== user.id,
        canCancel: request.status === "pending" && String(request.initiatorId) === user.id } : null };
  },
  async previewCreate(user: RequestUser, args: { orderId: string; scheduledAt: string; reason: string }) {
    const order = await ownedOrder(user, args.orderId);
    const preview = await previewOrderReschedule(args.orderId, user, new Date(args.scheduledAt));
    return { title: "Gửi đề nghị dời lịch", orderId: args.orderId, orderCode: order.orderCode,
      currentSchedule: preview.currentScheduledAt, schedule: preview.proposedScheduledAt, reason: args.reason,
      expectedOrderUpdatedAt: order.updatedAt.toISOString(),
      note: preview.approvalRequired ? "Lịch cũ vẫn có hiệu lực đến khi thợ đồng ý."
        : "Chưa có thợ nhận; lịch mới sẽ được áp dụng sau khi bạn xác nhận.",
      minAdvanceMinutes: preview.minAdvanceMinutes, responseMinutes: preview.responseMinutes };
  },
  async create(user: RequestUser, args: { orderId: string; scheduledAt: string; reason: string }, expected: unknown, actionId: string) {
    await ownedOrder(user, args.orderId);
    const version = (expected as { expectedOrderUpdatedAt: string }).expectedOrderUpdatedAt;
    const request = await createOrderRescheduleRequest(args.orderId, user,
      { scheduledAt: args.scheduledAt, reason: args.reason, expectedOrderUpdatedAt: version }, actionRequestId(user.id, actionId));
    return requestView(request);
  },
  async previewResponse(user: RequestUser, args: { orderId: string; requestId: string; decision?: "accept" | "reject"; reason?: string }, cancel = false) {
    const order = await ownedOrder(user, args.orderId);
    const request = await OrderRescheduleRequest.findOne({ _id: args.requestId, orderId: args.orderId, isDeleted: false });
    if (!request || request.status !== "pending" || !request.expiresAt || request.expiresAt.getTime() <= Date.now()) {
      throw new AppError("Đề nghị dời lịch không còn chờ phản hồi.", 409);
    }
    if (cancel ? String(request.initiatorId) !== user.id
      : request.approvalRole !== "customer" || String(request.initiatorId) === user.id) {
      throw new AppError("Bạn không có quyền thao tác đề nghị dời lịch này.", 403);
    }
    return { title: cancel ? "Thu hồi đề nghị dời lịch" : args.decision === "accept" ? "Đồng ý lịch mới thợ đề xuất" : "Từ chối lịch mới thợ đề xuất",
      orderId: args.orderId, orderCode: order.orderCode, requestId: args.requestId,
      currentSchedule: request.oldScheduledAt, schedule: request.proposedScheduledAt,
      responseDeadline: request.expiresAt, expectedOrderUpdatedAt: order.updatedAt.toISOString(), reason: args.reason,
      note: !cancel && args.decision === "accept" ? "Hệ thống kiểm tra lại lịch trống trước khi áp dụng lịch mới." : "Lịch hẹn cũ vẫn có hiệu lực." };
  },
  async respond(user: RequestUser, args: { orderId: string; requestId: string; decision: "accept" | "reject"; reason?: string }, expected: unknown) {
    await ownedOrder(user, args.orderId);
    return requestView(await respondOrderRescheduleRequest(args.orderId, args.requestId, user,
      { decision: args.decision, reason: args.reason, expectedOrderUpdatedAt: (expected as { expectedOrderUpdatedAt: string }).expectedOrderUpdatedAt }));
  },
  async cancel(user: RequestUser, args: { orderId: string; requestId: string }) {
    await ownedOrder(user, args.orderId);
    return requestView(await cancelOrderRescheduleRequest(args.orderId, args.requestId, user));
  },
  async reconcile(user: RequestUser, args: { orderId: string; requestId?: string; decision?: "accept" | "reject" }, actionId: string, mode: "create" | "respond" | "cancel") {
    await ownedOrder(user, args.orderId);
    const request = await OrderRescheduleRequest.findOne({
      _id: mode === "create" ? actionRequestId(user.id, actionId) : args.requestId,
      orderId: args.orderId, isDeleted: false,
      ...(mode === "create" ? { initiatorId: user.id } : { respondedBy: user.id,
        status: mode === "cancel" ? "cancelled" : args.decision === "accept" ? "applied" : "rejected" }),
    });
    return request ? requestView(request) : null;
  },
};
