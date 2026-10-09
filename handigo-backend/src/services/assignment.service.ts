import { serviceImageResponse } from "../utils/serviceImageResponse";
import mongoose, { Types } from "mongoose";
import { randomBytes } from "crypto";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { Payment } from "../models/payment.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { RepairQuotationItem } from "../models/repairQuotationItem.model";
import { AuditLog } from "../models/auditLog.model";
import type { INotification } from "../models/notification.model";
import { AppError } from "../utils/appError";
import { Address } from "../models/address.model";
import { emitToUser } from "../sockets/socketServer";
import { cancelOrderWithSettlement } from "./orderCancellation.service";
import { assertProviderWalletEligible } from "./providerWalletEligibility.service";
import type { UserRole } from "../models/user.model";
import { createNotificationRecord, emitRealtimeNotification } from "./notification.service";
import { requestDirectProviderReassignment } from "./orderReassignment.service";
import { getBookingPolicy } from "./systemConfig.service";
import { lockProviderSchedule, assertProviderSchedule } from "./providerSchedule.service";
import { calculateDuration } from "../utils/bookingPolicy";
import { createLogger } from "../utils/logger";
import {
  evaluateQuotationItemsForOrder,
  getBlockedRelevanceItems,
} from "./quotationRelevance.service";
import { isAddressInProviderWorkingAreas } from "../utils/providerArea";

const assignmentLogger = createLogger("AssignmentService");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcceptAssignmentResult {
  assignment: InstanceType<typeof OrderAssignment>;
  order: InstanceType<typeof Order>;
}

export interface QuotationItemInput {
  title: string;
  description?: string;
  itemType: "labor" | "material" | "replacement_part" | "other";
  quantity: number;
  unitPrice: number;
  note?: string;
}

export interface CreateQuotationPayload {
  estimatedDurationMinutes?: number;
  orderId: string;
  inspectionNote?: string;
  recommendation?: string;
  attachments?: string[];
  items: QuotationItemInput[];
  discountAmount?: number;
  relevanceConfirmed?: boolean;
}

export interface UpdateQuotationPayload extends CreateQuotationPayload {
  quotationId: string;
  expectedRevision: number;
}

const assertQuotationOrder = (
  order: InstanceType<typeof Order>,
  providerId: Types.ObjectId,
) => {
  if (order.providerId?.toString() !== providerId.toString()) {
    throw new AppError("Bạn không phải thợ được phân công cho đơn hàng này.", 403);
  }
  if (!["accepted", "in_progress"].includes(order.status)) {
    throw new AppError("Chỉ được lưu báo giá khi đơn đã nhận hoặc đang thực hiện.", 409);
  }
  if (["scheduled", "recurring"].includes(order.orderType) && order.bookingStatus !== "confirmed") {
    throw new AppError("Lịch hẹn chưa được thanh toán và xác nhận.", 409);
  }
};

const saveRepairQuotation = async (
  payload: CreateQuotationPayload | UpdateQuotationPayload,
  providerUserId: string,
): Promise<InstanceType<typeof RepairQuotation>> => {
  const order = await Order.findOne({ _id: payload.orderId, isDeleted: false });
  if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
  const provider = await Provider.findOne({ userId: providerUserId, verified: true, isDeleted: false });
  if (!provider) throw new AppError("Không tìm thấy hồ sơ thợ đã được duyệt.", 404);
  assertQuotationOrder(order, provider._id as Types.ObjectId);
  const service = await Service.findById(order.serviceId).select("serviceType").lean();
  if (!order.inspectionRequired && service?.serviceType !== "variable_price") {
    throw new AppError("Đơn hàng này không yêu cầu báo giá sửa chữa.", 400);
  }
  if (order.schedule && !payload.estimatedDurationMinutes) {
    throw new AppError("Vui lòng nhập thời gian sửa chữa dự kiến từ 1 đến 1440 phút.", 400);
  }
  const subtotalAmount = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = payload.discountAmount ?? 0;
  const finalAmount = subtotalAmount - discountAmount;
  if (!Number.isFinite(finalAmount) || finalAmount <= order.depositAmount) {
    throw new AppError("Tổng báo giá sau giảm giá phải lớn hơn tiền cọc.", 400);
  }
  const relevance = await evaluateQuotationItemsForOrder(order, payload.items);
  const blockedItems = getBlockedRelevanceItems(relevance);
  if (blockedItems.length) {
    throw new AppError(`Không thể lưu báo giá vì có hạng mục không phù hợp với dịch vụ ${relevance.serviceName}: ${blockedItems.slice(0, 3).map((item) => `"${item.title}"`).join(", ")}.`, 422);
  }

  const update = "expectedRevision" in payload ? payload : null;
  const policy = await getBookingPolicy();
  const session = await mongoose.startSession();
  let notification: INotification | undefined;
  try {
    const quotation = await session.withTransaction(async () => {
      notification = undefined;
      await lockProviderSchedule(provider._id as Types.ObjectId, session);
      const currentOrder = await Order.findOne({ _id: order._id, isDeleted: false }).session(session);
      if (!currentOrder) throw new AppError("Đơn hàng không tồn tại.", 404);
      assertQuotationOrder(currentOrder, provider._id as Types.ObjectId);
      if (currentOrder.depositAmount !== order.depositAmount) {
        throw new AppError("Tiền cọc đã thay đổi. Vui lòng tải lại đơn hàng.", 409);
      }
      let currentQuotation: InstanceType<typeof RepairQuotation>;
      let oldValue: Record<string, unknown> | null = null;
      let oldItems: InstanceType<typeof RepairQuotationItem>[] = [];
      if (update) {
        if (currentOrder.currentQuotationId?.toString() !== update.quotationId) {
          throw new AppError("Báo giá không còn là bản hiện tại. Vui lòng tải lại đơn hàng.", 409);
        }
        const existing = await RepairQuotation.findOne({ _id: update.quotationId, orderId: currentOrder._id, providerId: provider._id, isDeleted: false }).session(session);
        if (!existing) throw new AppError("Báo giá không tồn tại.", 404);
        if (!["saved", "approved"].includes(existing.status)) {
          throw new AppError("Chỉ được chỉnh sửa báo giá đã lưu hoặc đã được chấp thuận.", 409);
        }
        if ((existing.revision ?? 0) !== update.expectedRevision) {
          throw new AppError("Báo giá đã được cập nhật ở phiên khác. Vui lòng tải lại trước khi sửa tiếp.", 409);
        }
        oldItems = await RepairQuotationItem.find({ quotationId: existing._id, isDeleted: false }).session(session);
        oldValue = { ...existing.toObject(), items: oldItems.map((item) => item.toObject()) };
        currentQuotation = existing;
      } else {
        if (currentOrder.currentQuotationId) {
          throw new AppError("Đơn hàng đã có báo giá. Vui lòng chỉnh sửa bản hiện tại.", 409);
        }
        currentQuotation = new RepairQuotation({
          quotationCode: `QUO-${randomBytes(6).toString("hex").toUpperCase()}`,
          orderId: currentOrder._id, customerId: currentOrder.customerId, providerId: provider._id,
        });
      }

      const duration = payload.estimatedDurationMinutes;
      if (currentOrder.status === "in_progress" && duration && duration !== currentQuotation.estimatedDurationMinutes) {
        const start = currentOrder.schedule?.expectedStartAt;
        if (!start) throw new AppError("Đơn chưa có giờ bắt đầu để cập nhật thời lượng sửa chữa.", 409);
        const expectedEndAt = new Date(start.getTime() + duration * 60_000);
        if (expectedEndAt.getTime() <= Date.now()) {
          throw new AppError("Thời lượng mới phải có giờ kết thúc dự kiến sau thời điểm hiện tại.", 409);
        }
        currentOrder.schedule = {
          durationMinutes: duration,
          bufferMinutes: currentOrder.schedule?.bufferMinutes ?? policy.bufferMinutes,
          travelMinutes: currentOrder.schedule?.travelMinutes ?? policy.travelMinutes,
          expectedStartAt: start, expectedEndAt,
        };
        await assertProviderSchedule(provider._id as Types.ObjectId, [currentOrder], session, policy);
      }

      currentQuotation.set({
        status: "saved", revision: (currentQuotation.revision ?? 0) + 1,
        estimatedDurationMinutes: duration,
        inspectionNote: payload.inspectionNote ?? null,
        recommendation: payload.recommendation ?? null,
        attachments: payload.attachments ?? currentQuotation.attachments ?? [],
        subtotalAmount, discountAmount, finalAmount,
        approvedAt: null, customerConfirmed: false, providerConfirmed: true,
        directPaymentConfirmedAt: null, directPaymentConfirmedAmount: null,
      });
      await currentQuotation.save({ session });
      if (update) {
        await RepairQuotationItem.updateMany(
          { quotationId: currentQuotation._id, isDeleted: false },
          { $set: { isDeleted: true, deletedAt: new Date() } },
          { session, runValidators: true },
        );
      }
      const items = await RepairQuotationItem.insertMany(payload.items.map((item) => ({
        ...item, quotationId: currentQuotation._id, totalPrice: item.unitPrice * item.quantity,
      })), { session });
      currentOrder.inspectionRequired = true;
      currentOrder.currentQuotationId = currentQuotation._id as Types.ObjectId;
      currentOrder.hasAdditionalQuotation = true;
      currentOrder.confirmation.customerConfirmedAt = null;
      if (oldValue?.directPaymentConfirmedAt && currentOrder.paymentStatus === "paid") {
        currentOrder.paymentStatus = "partially_paid";
      }
      await currentOrder.save({ session });
      await AuditLog.create([{
        actorId: new Types.ObjectId(providerUserId),
        actorRole: "provider", action: update ? "UPDATE_QUOTATION" : "SAVE_QUOTATION",
        targetType: "RepairQuotation", targetId: currentQuotation._id,
        oldValue, newValue: { ...currentQuotation.toObject(), items: items.map((item) => item.toObject()) },
        description: update ? "Thợ cập nhật báo giá sửa chữa." : "Thợ lưu báo giá sửa chữa.",
      }], { session });
      const changedItems = oldItems.map((item) => ({ title: item.title, description: item.description ?? null, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, note: item.note ?? null }));
      const newItems = payload.items.map((item) => ({ title: item.title, description: item.description ?? null, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, note: item.note ?? null }));
      if (!update || oldValue?.finalAmount !== finalAmount || JSON.stringify(changedItems) !== JSON.stringify(newItems)) {
        notification = await createNotificationRecord({
          userId: currentOrder.customerId, type: "QUOTATION",
          title: update ? "Báo giá đã được cập nhật" : "Báo giá đã được lưu",
          content: `Thợ đã ${update ? "cập nhật" : "lưu"} báo giá cho đơn ${currentOrder.orderCode}. Vui lòng xem chi phí mới nhất.`,
          data: { orderId: currentOrder.id, quotationId: currentQuotation.id, revision: currentQuotation.revision },
        }, { session });
      }
      return currentQuotation;
    });
    if (!quotation) throw new AppError("Không thể lưu báo giá.", 409);
    if (notification) emitRealtimeNotification(notification);
    emitToUser(order.customerId.toString(), "quotation:updated", { orderId: order.id, revision: quotation.revision });
    return quotation;
  } finally {
    await session.endSession();
  }
};

const closeCompetingAssignments = async (
  orderId: Types.ObjectId,
  acceptedAssignmentId: Types.ObjectId,
) => {
  const competingAssignments = await OrderAssignment.find({
    orderId,
    _id: { $ne: acceptedAssignmentId },
    status: "pending",
    isDeleted: false,
  })
    .select("_id providerId")
    .lean();
  if (competingAssignments.length === 0) return;

  const respondedAt = new Date();
  await OrderAssignment.updateMany(
    {
      _id: { $in: competingAssignments.map((item) => item._id) },
      status: "pending",
    },
    { $set: { status: "cancelled", respondedAt } },
    { runValidators: true },
  );

  const providers = await Provider.find({
    _id: { $in: competingAssignments.map((item) => item.providerId) },
    isDeleted: false,
  })
    .select("_id userId")
    .lean();
  const userIdByProviderId = new Map(
    providers.map((provider) => [
      provider._id.toString(),
      provider.userId.toString(),
    ]),
  );
  for (const competingAssignment of competingAssignments) {
    const userId = userIdByProviderId.get(
      competingAssignment.providerId.toString(),
    );
    if (!userId) continue;
    emitToUser(userId, "assignment:closed", {
      assignmentId: competingAssignment._id.toString(),
      reason: "accepted_by_other",
    });
  }
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const AssignmentService = {
  /**
   * Step 4a – Provider accepts assignment.
   *
   * - Marks assignment as accepted.
   * - Updates order.providerId and order.status → "accepted".
   * - Sets provider.availabilityStatus → "busy".
   * - Cancels remaining pending assignments for the same order.
   */
  async acceptAssignment(
    assignmentId: string,
    providerUserId: string,
  ): Promise<AcceptAssignmentResult> {
    // 1. Load assignment
    const assignment = await OrderAssignment.findOne({
      _id: assignmentId,
      isDeleted: false,
    });
    if (!assignment) throw new AppError("Assignment không tồn tại.", 404);

    // 2. Verify provider owns this assignment
    const provider = await Provider.findOne({
      userId: providerUserId,
      verified: true,
      isDeleted: false,
    });
    if (!provider) throw new AppError("Provider không tồn tại.", 404);
    if (assignment.providerId.toString() !== provider._id.toString()) {
      throw new AppError("Bạn không có quyền thực hiện thao tác này.", 403);
    }
    if (provider.availabilityStatus !== "online") {
      throw new AppError(
        "Bạn cần bật trạng thái trực tuyến để nhận đơn.",
        409,
      );
    }

    // 3. Check assignment is still pending and not expired
    if (assignment.status !== "pending") {
      throw new AppError(
        `Assignment đã ở trạng thái "${assignment.status}", không thể accept.`,
        400,
      );
    }
    if (assignment.responseDeadline < new Date()) {
      throw new AppError(
        assignment.assignmentType === "direct_request"
          ? "Yêu cầu trực tiếp đã hết thời gian phản hồi."
          : "Thời gian phản hồi đã hết hạn. Hệ thống đang chuyển đơn sang provider khác.",
        400,
      );
    }

    const assignedOrder = await Order.findById(assignment.orderId).select(
      "addressId customerId orderCode orderType scheduledAt status recurringGroupId occurrenceNumber paymentStatus paymentMethod",
    );
    const assignedAddress = assignedOrder
      ? await Address.findById(assignedOrder.addressId).select("ward province")
      : null;
    // Phạm vi địa lý đã được kiểm tra khi gửi đề nghị; không chặn lại theo phường/xã.
    if (!assignedAddress) {
      throw new AppError("Địa chỉ thực hiện dịch vụ không còn tồn tại.", 400);
    }

    await assertProviderWalletEligible(provider.userId);

    if (assignment.assignmentType === "appointment") {
      if (!assignedOrder || !assignedOrder.scheduledAt || assignedOrder.status !== "created") {
        throw new AppError("Lịch hẹn không còn khả dụng.", 409);
      }
      const hasInitialPayment = ["paid", "partially_paid"].includes(assignedOrder.paymentStatus)
        || (assignedOrder.paymentMethod === "cash" && await Payment.exists({
          orderId: assignedOrder._id, method: "cash", status: "pending", isDeleted: false,
        }));
      if (!hasInitialPayment) {
        throw new AppError("Đơn hàng chưa hoàn tất bước thanh toán.", 409);
      }

      const appointmentOrders = assignedOrder.recurringGroupId
        ? await Order.find({
            recurringGroupId: assignedOrder.recurringGroupId,
            status: "created",
            isDeleted: false,
          }).select("scheduledAt")
        : [assignedOrder];
      for (const appointmentOrder of appointmentOrders) {
        if (!appointmentOrder.scheduledAt) continue;
        const conflictStart = new Date(
          appointmentOrder.scheduledAt.getTime() - 60 * 60 * 1000,
        );
        const slotEnd = new Date(
          appointmentOrder.scheduledAt.getTime() + 60 * 60 * 1000,
        );
        const hasConflict = await Order.exists({
          _id: { $nin: appointmentOrders.map((item) => item._id) },
          providerId: provider._id,
          status: { $in: ["accepted", "in_progress"] },
          scheduledAt: { $gt: conflictStart, $lt: slotEnd },
          isDeleted: false,
        });
        if (hasConflict) {
          throw new AppError(
            `Bạn đã có lịch vào ${appointmentOrder.scheduledAt.toLocaleString("vi-VN")}.`,
            409,
          );
        }
      }

      const respondedAt = new Date();
      const claimedAssignment = await OrderAssignment.findOneAndUpdate(
        {
          _id: assignment._id,
          providerId: provider._id,
          status: "pending",
          responseDeadline: { $gt: respondedAt },
          isDeleted: false,
        },
        { $set: { status: "accepted", respondedAt } },
        { returnDocument: "after", runValidators: true },
      );
      if (!claimedAssignment) {
        throw new AppError("Yêu cầu lịch hẹn không còn khả dụng.", 409);
      }

      const order = await Order.findOneAndUpdate(
        { _id: assignment.orderId, status: "created", providerId: null },
        {
          $set: {
            providerId: provider._id,
            status: "accepted",
            bookingStatus: "confirmed",
            paymentDueAt: null,
            readyForMatching: false,
          },
        },
        { returnDocument: "after", runValidators: true },
      );
      if (!order) {
        await OrderAssignment.findByIdAndUpdate(claimedAssignment._id, {
          $set: { status: "cancelled" },
        });
        emitToUser(providerUserId, "assignment:closed", {
          assignmentId: assignment._id.toString(),
          reason: "accepted_by_other",
        });
        throw new AppError("Lịch hẹn vừa được xử lý bởi yêu cầu khác.", 409);
      }

      if (assignedOrder.recurringGroupId) {
        await Order.updateMany(
          {
            _id: { $ne: order._id },
            recurringGroupId: assignedOrder.recurringGroupId,
            status: "created",
            providerId: null,
          },
          {
            $set: {
              providerId: provider._id,
              status: "accepted",
              bookingStatus: "reserved",
              paymentDueAt: null,
              readyForMatching: false,
            },
          },
          { runValidators: true },
        );
      }

      emitToUser(order.customerId.toString(), "order:updated", {
        orderId: order._id.toString(),
        recurringGroupId: order.recurringGroupId?.toString(),
      });

      await closeCompetingAssignments(
        assignment.orderId,
        claimedAssignment._id as Types.ObjectId,
      );

      emitToUser(providerUserId, "assignment:closed", {
        assignmentId: assignment._id.toString(),
        reason: "accepted",
      });
      await createNotificationRecord({
        userId: order.customerId,
        type: "ORDER",
        title: assignedOrder.recurringGroupId
          ? "Chuyên gia đã nhận chuỗi lịch"
          : "Chuyên gia đã nhận lịch",
        content: `Chuyên gia đã nhận đơn ${order.orderCode} và sẽ thực hiện theo lịch hẹn.`,
        data: { orderId: order._id },
      });

      return {
        assignment: claimedAssignment,
        order,
      };
    }

    const policy = await getBookingPolicy();
    const session = await mongoose.startSession();
    let result: AcceptAssignmentResult | null = null;
    try {
      result = await session.withTransaction(async () => {
        const lockedProvider = await lockProviderSchedule(provider._id as Types.ObjectId, session);
        const order = await Order.findOne({
          _id: assignment.orderId,
          status: "created",
          providerId: null,
          readyForMatching: true,
          isDeleted: false,
        }).session(session);
        if (!order) throw new AppError("Đơn hàng không còn khả dụng để nhận.", 409);

        const hasInitialPayment = ["paid", "partially_paid"].includes(order.paymentStatus)
          || (order.paymentMethod === "cash" && await Payment.exists({
            orderId: order._id, method: "cash", status: "pending", isDeleted: false,
          }).session(session));
        if (!hasInitialPayment) throw new AppError("Đơn hàng chưa hoàn tất bước thanh toán.", 409);

        const durationMinutes = order.schedule?.durationMinutes
          ?? calculateDuration(order.serviceId.toString(), order.inspectionRequired, order.selectedOptionsSnapshot, policy);
        const travelMinutes = order.schedule?.travelMinutes ?? policy.travelMinutes;
        const expectedStartAt = order.scheduledAt ?? new Date(Date.now() + travelMinutes * 60000);
        order.schedule = {
          durationMinutes,
          bufferMinutes: order.schedule?.bufferMinutes ?? policy.bufferMinutes,
          travelMinutes,
          expectedStartAt,
          expectedEndAt: new Date(expectedStartAt.getTime() + durationMinutes * 60000),
        };
        await assertProviderSchedule(lockedProvider._id as Types.ObjectId, [order], session, policy);

        const respondedAt = new Date();
        const claimedAssignment = await OrderAssignment.findOneAndUpdate(
          {
            _id: assignment._id,
            providerId: lockedProvider._id,
            status: "pending",
            responseDeadline: { $gt: respondedAt },
            isDeleted: false,
          },
          { $set: { status: "accepted", respondedAt } },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!claimedAssignment) throw new AppError("Yêu cầu nhận đơn không còn khả dụng.", 409);

        order.providerId = lockedProvider._id as Types.ObjectId;
        order.status = "accepted";
        order.readyForMatching = false;
        lockedProvider.availabilityStatus = "busy";
        await lockedProvider.save({ session });
        await order.save({ session });
        return { assignment: claimedAssignment, order };
      }) ?? null;
    } finally {
      await session.endSession();
    }
    if (!result) throw new AppError("Không thể nhận đơn.", 409);
    emitToUser(result.order.customerId.toString(), "order:updated", {
      orderId: result.order._id.toString(),
      recurringGroupId: result.order.recurringGroupId?.toString(),
    });
    try {
      await closeCompetingAssignments(result.order._id as Types.ObjectId, result.assignment._id as Types.ObjectId);
      emitToUser(providerUserId, "assignment:closed", { assignmentId, reason: "accepted" });
      await createNotificationRecord({
        userId: result.order.customerId,
        type: "ORDER",
        title: "Chuyên gia đã nhận đơn",
        content: `Chuyên gia đã nhận đơn ${result.order.orderCode}.`,
        data: { orderId: result.order._id },
      });
    } catch (error) {
      assignmentLogger.error("Đã nhận đơn nhưng chưa hoàn tất thông báo.", error, { assignmentId });
    }
    return result;
  },

  /**
   * Step 4b – Provider rejects assignment.
   *
   * - Marks assignment as rejected.
   * - Triggers re-dispatch to the next nearest provider.
   */
  async rejectAssignment(
    assignmentId: string,
    providerUserId: string,
    rejectReason?: string,
  ): Promise<void> {
    // 1. Load assignment
    const assignment = await OrderAssignment.findOne({
      _id: assignmentId,
      isDeleted: false,
    });
    if (!assignment) throw new AppError("Assignment không tồn tại.", 404);

    // 2. Verify provider
    const provider = await Provider.findOne({
      userId: providerUserId,
      verified: true,
      isDeleted: false,
    });
    if (!provider) throw new AppError("Provider không tồn tại.", 404);
    if (assignment.providerId.toString() !== provider._id.toString()) {
      throw new AppError("Bạn không có quyền thực hiện thao tác này.", 403);
    }

    if (assignment.status !== "pending") {
      throw new AppError(
        `Assignment đã ở trạng thái "${assignment.status}".`,
        400,
      );
    }

    // 3. Reject bằng cập nhật có điều kiện để tránh re-dispatch hai lần.
    const rejectedAssignment = await OrderAssignment.findOneAndUpdate(
      {
        _id: assignment._id,
        providerId: provider._id,
        status: "pending",
        isDeleted: false,
      },
      {
        $set: {
          status: "rejected",
          rejectReason: rejectReason ?? null,
          respondedAt: new Date(),
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!rejectedAssignment) {
      throw new AppError("Assignment không còn ở trạng thái chờ phản hồi.", 409);
    }

    emitToUser(providerUserId, "assignment:closed", {
      assignmentId: assignment._id.toString(),
      reason: "rejected",
    });

    if (assignment.assignmentType === "appointment") {
      const appointmentOrder = await Order.findById(assignment.orderId).select(
        "recurringGroupId preferredProviderId",
      );
      if (appointmentOrder?.preferredProviderId) {
        await requestDirectProviderReassignment(
          assignment.orderId.toString(),
          provider._id as Types.ObjectId,
          rejectReason,
        );
        return;
      }
      if (appointmentOrder?.preferredProviderId && appointmentOrder.recurringGroupId) {
        await Order.updateMany(
          {
            recurringGroupId: appointmentOrder.recurringGroupId,
            status: "created",
          },
          {
            $set: {
              bookingStatus: "rejected",
              preferredProviderId: null,
              paymentDueAt: null,
            },
          },
          { runValidators: true },
        );
      }
      if (appointmentOrder?.preferredProviderId) {
        const order = await Order.findOneAndUpdate(
          { _id: assignment.orderId, status: "created" },
          {
            $set: {
              bookingStatus: "rejected",
              preferredProviderId: null,
              paymentDueAt: null,
            },
          },
          { returnDocument: "after", runValidators: true },
        );
        if (order) {
          await createNotificationRecord({
            userId: order.customerId,
            type: "ORDER",
            title: "Chuyên gia chưa thể nhận lịch",
            content: `Lịch hẹn ${order.orderCode} cần chọn một chuyên gia khác.`,
            data: { orderId: order._id },
          });
        }
        return;
      }
    }

    if (assignment.assignmentType === "direct_request") {
      await requestDirectProviderReassignment(
        assignment.orderId.toString(),
        provider._id as Types.ObjectId,
        rejectReason,
      );
      return;
    }

    const hasPendingAssignment = await OrderAssignment.exists({
      orderId: assignment.orderId,
      status: "pending",
      isDeleted: false,
    });
    if (hasPendingAssignment) return;

    // 4. Re-dispatch to next provider (import lazily to avoid circular dep)
    const order = await Order.findById(assignment.orderId);
    if (!order || order.status !== "created") return;

    const { DispatchService } = await import("./dispatch.service");
    await DispatchService.redispatch(order._id.toString());
  },

  // ────────────────────────────────────────────────────────────────────────────
  // REPAIR SERVICE – Quotation Flow
  // ────────────────────────────────────────────────────────────────────────────

  /** Lưu báo giá sau khảo sát, có thể chỉnh sửa tới khi kết thúc đơn. */
  async createRepairQuotation(
    payload: CreateQuotationPayload,
    providerUserId: string,
  ): Promise<InstanceType<typeof RepairQuotation>> {
    return saveRepairQuotation(payload, providerUserId);
  },

  async updateRepairQuotation(
    payload: UpdateQuotationPayload,
    providerUserId: string,
  ): Promise<InstanceType<typeof RepairQuotation>> {
    return saveRepairQuotation(payload, providerUserId);
  },

  /** Thợ xác nhận khoản sửa chữa đã nhận trực tiếp từ khách theo báo giá hiện tại. */
  async confirmQuotationPayment(
    orderId: string,
    providerUserId: string,
    quotationId: string,
    expectedRevision: number,
  ): Promise<InstanceType<typeof RepairQuotation>> {
    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const provider = await Provider.findOne({ userId: providerUserId, verified: true, isDeleted: false }).session(session);
        if (!provider) throw new AppError("Không tìm thấy hồ sơ thợ đã được duyệt.", 403);
        await lockProviderSchedule(provider._id as Types.ObjectId, session);
        const order = await Order.findOne({ _id: orderId, isDeleted: false }).session(session);
        if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
        if (order.providerId?.toString() !== provider.id) {
          throw new AppError("Bạn không phải thợ được phân công cho đơn hàng này.", 403);
        }
        if (!order.inspectionRequired || order.status !== "completed" || !order.depositPaidAt) {
          throw new AppError("Không thể xác nhận thanh toán báo giá ở trạng thái hiện tại của đơn hàng.", 409);
        }
        if (order.currentQuotationId?.toString() !== quotationId) {
          throw new AppError("Báo giá không còn là bản hiện tại. Vui lòng tải lại đơn hàng.", 409);
        }
        const quotation = await RepairQuotation.findOne({ _id: quotationId, orderId: order._id, providerId: provider._id, isDeleted: false }).session(session);
        if (!quotation) throw new AppError("Báo giá không tồn tại.", 404);
        if (quotation.status !== "saved" && !(quotation.status === "approved" && quotation.customerConfirmed)) {
          throw new AppError("Báo giá chưa đủ điều kiện xác nhận thanh toán.", 409);
        }
        if ((quotation.revision ?? 0) !== expectedRevision) {
          throw new AppError("Báo giá đã thay đổi. Vui lòng tải lại và kiểm tra số tiền trước khi xác nhận.", 409);
        }
        const appliedDeposit = order.pricing.baseAmount !== undefined
          ? Math.max(order.pricing.totalPaidAmount, 0)
          : Math.max(order.depositAmount, 0);
        const amount = Math.max(quotation.finalAmount - appliedDeposit, 0);
        if (!Number.isFinite(amount)) throw new AppError("Số tiền thanh toán báo giá không hợp lệ.", 409);
        // Cùng ghi vào đơn để phát hiện xung đột với thao tác hủy hoặc hoàn thành.
        const claimedOrder = await Order.updateOne(
          { _id: order._id, providerId: provider._id, status: order.status, currentQuotationId: quotation._id, isDeleted: false },
          { $set: { paymentStatus: "paid" }, $inc: { __v: 1 } },
          { session, runValidators: true },
        );
        if (claimedOrder.matchedCount !== 1) throw new AppError("Đơn hàng đã thay đổi. Vui lòng tải lại trước khi xác nhận.", 409);
        if (quotation.directPaymentConfirmedAt) return quotation;
        const oldValue = { ...quotation.toObject() };
        quotation.directPaymentConfirmedAt = new Date();
        quotation.directPaymentConfirmedAmount = amount;
        await quotation.save({ session });
        await AuditLog.create([{
          actorId: new Types.ObjectId(providerUserId), actorRole: "provider",
          action: "CONFIRM_QUOTATION_PAYMENT", targetType: "RepairQuotation", targetId: quotation._id,
          oldValue, newValue: { ...quotation.toObject() },
          description: "Thợ xác nhận đã nhận tiền sửa chữa trực tiếp từ khách.",
        }], { session });
        return quotation;
      });
      if (!result) throw new AppError("Không thể xác nhận thanh toán báo giá.", 500);
      try {
        emitToUser(result.customerId.toString(), "quotation:updated", { orderId, revision: result.revision });
      } catch {
        assignmentLogger.warn("Đã xác nhận thanh toán báo giá; chưa gửi được tín hiệu cập nhật cho khách.", { orderId });
      }
      return result;
    } finally {
      await session.endSession();
    }
  },

  /** Giữ xác nhận cho báo giá chờ duyệt cũ; báo giá đã lưu không cần khách xác nhận. */
  async confirmRepairQuotation(
    quotationId: string,
    customerUserId: string,
  ): Promise<InstanceType<typeof RepairQuotation>> {
    const session = await mongoose.startSession();
    let approvedQuotation: InstanceType<typeof RepairQuotation> | null = null;

    try {
      await session.withTransaction(async () => {
        const quotation = await RepairQuotation.findById(quotationId).session(
          session,
        );
        if (!quotation) throw new AppError("Báo giá không tồn tại.", 404);
        if (
          quotation.status !== "pending" &&
          quotation.status !== "saved" &&
          !(quotation.status === "approved" && quotation.customerConfirmed)
        ) {
          throw new AppError(
            `Báo giá đã ở trạng thái "${quotation.status}".`,
            400,
          );
        }

        const order = await Order.findById(quotation.orderId).session(session);
        if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
        if (order.customerId.toString() !== customerUserId) {
          throw new AppError("Bạn không có quyền xác nhận báo giá này.", 403);
        }
        if (order.currentQuotationId?.toString() !== quotation.id) {
          throw new AppError("Báo giá này không còn là báo giá hiện tại.", 409);
        }
        if (quotation.status === "saved" || (quotation.status === "approved" && quotation.customerConfirmed)) {
          approvedQuotation = quotation;
          return;
        }
        if (!order.inspectionRequired || !["accepted", "in_progress"].includes(order.status)) {
          throw new AppError(
            "Không thể xác nhận báo giá ở trạng thái hiện tại của đơn hàng.",
            409,
          );
        }

        const confirmedAt = new Date();

        quotation.status = "approved";
        quotation.customerConfirmed = true;
        quotation.approvedAt = confirmedAt;
        await quotation.save({ session });

        order.confirmation.customerConfirmedAt = confirmedAt;
        await order.save({ session });

        approvedQuotation = quotation;
      });
    } finally {
      await session.endSession();
    }

    if (!approvedQuotation) {
      throw new AppError("Không thể xác nhận báo giá.", 500);
    }
    return approvedQuotation;
  },

  /**
   * Customer rejects the repair quotation.
   * The order is then cancelled.
   */
  async rejectRepairQuotation(
    quotationId: string,
    customerUserId: string,
    rejectionReason?: string,
  ): Promise<InstanceType<typeof RepairQuotation>> {
    const quotation = await RepairQuotation.findById(quotationId);
    if (!quotation) throw new AppError("Báo giá không tồn tại.", 404);
    if (quotation.status !== "pending") {
      throw new AppError(
        `Báo giá đã ở trạng thái "${quotation.status}".`,
        400,
      );
    }

    const order = await Order.findById(quotation.orderId);
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
    if (order.customerId.toString() !== customerUserId) {
      throw new AppError("Bạn không có quyền từ chối báo giá này.", 403);
    }

    quotation.status = "rejected";
    quotation.rejectedAt = new Date();
    quotation.rejectionReason = rejectionReason ?? null;
    await quotation.save();

    await cancelOrderWithSettlement({
      orderId: order._id.toString(),
      actorId: customerUserId,
      role: "customer",
      reason:
        "Từ chối báo giá sửa chữa: " +
        (rejectionReason ?? "không có lý do"),
    });

    return quotation as any;
  },

  /**
   * Get all assignments for an order (admin / audit).
   */
  async getAssignmentsByOrder(
    orderId: string,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    const order = await Order.findOne({
      _id: orderId,
      isDeleted: false,
    })
      .select("customerId providerId")
      .lean();
    if (!order) {
      throw new AppError("Đơn hàng không tồn tại.", 404);
    }

    let hasAccess = actorRole === "ADMIN";
    if (actorRole === "CUSTOMER") {
      hasAccess = order.customerId.toString() === actorUserId;
    }
    if (actorRole === "PROVIDER") {
      const provider = await Provider.findOne({
        userId: actorUserId,
        verified: true,
        isDeleted: false,
      })
        .select("_id")
        .lean();
      hasAccess = Boolean(
        provider &&
        order.providerId &&
        order.providerId.toString() === provider._id.toString(),
      );
    }
    if (!hasAccess) {
      throw new AppError(
        "Bạn không có quyền xem lịch sử phân công của đơn hàng này.",
        403,
      );
    }

    return OrderAssignment.find({ orderId, isDeleted: false })
      .sort({ assignedAt: 1 })
      .populate("providerId", "userId averageRating totalCompletedOrders")
      .lean();
  },

  /**
   * Get pending assignment for the currently-logged-in provider.
   */
  async getPendingAssignmentForProvider(providerUserId: string) {
    const provider = await Provider.findOne({
      userId: providerUserId,
      verified: true,
      isDeleted: false,
    });
    if (!provider) throw new AppError("Provider không tồn tại.", 404);

    return OrderAssignment.find({
      providerId: provider._id,
      status: "pending",
      isDeleted: false,
    })
      .populate({
        path: "orderId",
        select: [
          "orderCode",
          "serviceId",
          "addressId",
          "orderType",
          "scheduledAt",
          "recurringGroupId",
          "recurrenceUnit",
          "occurrenceNumber",
          "totalOccurrences",
          "pricing",
          "inspectionRequired",
          "createdAt",
        ].join(" "),
        populate: [
          { path: "serviceId", select: "name image coverImage serviceType depositAmount fixedPrice", transform: serviceImageResponse },
          { path: "addressId", select: "ward province" },
        ],
      })
      .sort({ assignedAt: -1 })
      .lean();
  },

  /** Đọc báo giá và hạng mục trong cùng phiên bản dữ liệu. */
  async getQuotationByOrder(
    orderId: string,
    userId: string,
    role: "CUSTOMER" | "PROVIDER",
  ) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const order = await Order.findOne({ _id: orderId, isDeleted: false }).session(session);
        if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
        if (role === "CUSTOMER") {
          if (order.customerId.toString() !== userId) {
            throw new AppError("Bạn không có quyền xem báo giá của đơn hàng này.", 403);
          }
        } else {
          const provider = await Provider.findOne({ userId, verified: true, isDeleted: false }).session(session);
          if (!provider) throw new AppError("Không tìm thấy hồ sơ thợ.", 404);
          if (order.providerId?.toString() !== provider._id.toString()) {
            throw new AppError("Bạn không có quyền xem báo giá của đơn hàng này.", 403);
          }
        }
        if (!order.currentQuotationId) return null;
        const quotation = await RepairQuotation.findOne({ _id: order.currentQuotationId, isDeleted: false }).session(session).lean();
        if (!quotation) return null;
        const items = await RepairQuotationItem.find({ quotationId: quotation._id, isDeleted: false }).session(session).lean();
        return { quotation, items };
      }, { readConcern: { level: "snapshot" } });
    } finally {
      await session.endSession();
    }
  },
};
