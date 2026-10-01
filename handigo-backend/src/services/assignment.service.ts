import mongoose, { Types } from "mongoose";
import { randomBytes } from "crypto";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { Payment } from "../models/payment.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { RepairQuotationItem } from "../models/repairQuotationItem.model";
import { AppError } from "../utils/appError";
import { Address } from "../models/address.model";
import { emitToUser } from "../sockets/socketServer";
import { cancelOrderWithSettlement } from "./orderCancellation.service";
import { assertProviderWalletEligible } from "./providerWalletEligibility.service";
import type { UserRole } from "../models/user.model";
import { createNotificationRecord } from "./notification.service";
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

      await closeCompetingAssignments(
        assignment.orderId,
        claimedAssignment._id as Types.ObjectId,
      );

      emitToUser(providerUserId, "assignment:closed", {
        assignmentId: assignment._id.toString(),
        reason: "accepted",
      });
    } finally {
      await session.endSession();
    }
    if (!result) throw new AppError("Không thể nhận đơn.", 409);
    try {
      await closeCompetingAssignments(result.order._id as Types.ObjectId, result.assignment._id as Types.ObjectId);
      emitToUser(providerUserId, "assignment:closed", { assignmentId, reason: "accepted" });
      await createNotificationRecord({
        userId: result.order.customerId,
        type: "ORDER",
        title: assignedOrder.recurringGroupId
          ? "Chuyên gia đã nhận chuỗi lịch"
          : "Chuyên gia đã nhận lịch",
        content: `Chuyên gia đã nhận đơn ${order.orderCode} và sẽ thực hiện theo lịch hẹn.`,
        data: { orderId: order._id },
      });

      return {
        assignment: claimedAssignment as any,
        order: order as any,
      };
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

  /**
   * Provider creates a RepairQuotation after inspection.
   * Only available for orders where inspectionRequired === true.
   */
  async createRepairQuotation(
    payload: CreateQuotationPayload,
    providerUserId: string,
  ): Promise<InstanceType<typeof RepairQuotation>> {
    const order = await Order.findById(payload.orderId);
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);
    const service = await Service.findById(order.serviceId).select("serviceType").lean();
    const requiresQuotation = order.inspectionRequired || service?.serviceType === "variable_price";
    if (!requiresQuotation) {
      throw new AppError(
        "Đơn hàng này không yêu cầu báo giá sửa chữa.",
        400,
      );
    }
    if (order.schedule && !payload.estimatedDurationMinutes) throw new AppError("Vui lòng nhập thời gian sửa chữa dự kiến từ 1 đến 1440 phút.", 400);

    const provider = await Provider.findOne({
      userId: providerUserId,
      verified: true,
      isDeleted: false,
    });
    if (!provider) throw new AppError("Provider không tồn tại.", 404);
    if (
      !order.providerId ||
      order.providerId.toString() !== provider._id.toString()
    ) {
      throw new AppError(
        "Bạn không phải provider được phân công cho đơn hàng này.",
        403,
      );
    }

    if (
      ["scheduled", "recurring"].includes(order.orderType) &&
      order.bookingStatus !== "confirmed"
    ) {
      throw new AppError(
        "Khách hàng chưa thanh toán giữ lịch. Bạn chỉ có thể gửi báo giá sau khi lịch hẹn được xác nhận.",
        409,
      );
    }

    if (!["accepted", "in_progress"].includes(order.status)) {
      throw new AppError(
        "Chỉ có thể tạo báo giá khi đơn hàng đang ở trạng thái accepted hoặc in_progress.",
        400,
      );
    }

    const relevance = await evaluateQuotationItemsForOrder(
      order,
      payload.items,
    );
    const blockedItems = getBlockedRelevanceItems(relevance);
    if (blockedItems.length) {
      const titles = blockedItems
        .slice(0, 3)
        .map((item) => `"${item.title}"`)
        .join(", ");
      throw new AppError(
        `Không thể gửi báo giá vì có hạng mục không phù hợp với dịch vụ ${relevance.serviceName}: ${titles}.`,
        422,
      );
    }
    if (relevance.status === "warning" && !payload.relevanceConfirmed) {
      throw new AppError(
        "Báo giá có hạng mục cần kiểm tra thêm. Vui lòng xem cảnh báo và xác nhận trước khi gửi.",
        409,
      );
    }

    // Calculate totals
    const subtotalAmount = payload.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const discountAmount = payload.discountAmount ?? 0;
    const finalAmount = Math.max(subtotalAmount - discountAmount, 0);
    const quotationCode = `QUO-${randomBytes(6).toString("hex").toUpperCase()}`;

    // Create quotation
    const quotation = await RepairQuotation.create({
      estimatedDurationMinutes: payload.estimatedDurationMinutes,
      quotationCode,
      orderId: order._id,
      customerId: order.customerId,
      providerId: provider._id,
      status: "pending",
      inspectionNote: payload.inspectionNote ?? null,
      recommendation: payload.recommendation ?? null,
      attachments: payload.attachments ?? [],
      subtotalAmount,
      discountAmount,
      finalAmount,
      customerConfirmed: false,
      providerConfirmed: true,
    });

    // Create quotation items
    const itemDocs = payload.items.map((item) => ({
      quotationId: quotation._id,
      title: item.title,
      description: item.description ?? null,
      itemType: item.itemType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * item.quantity,
      note: item.note ?? null,
    }));
    await RepairQuotationItem.insertMany(itemDocs);

    // Link quotation to order
    // Đơn cũ có thể chưa lưu inspectionRequired dù dịch vụ là báo giá theo khảo sát.
    order.inspectionRequired = true;
    order.currentQuotationId = quotation._id as Types.ObjectId;
    order.hasAdditionalQuotation = true;
    await order.save();

    return quotation as any;
  },

  /**
   * Khách hàng đồng ý báo giá sửa chữa.
   * Sau khi xác nhận, provider có thể chủ động bắt đầu công việc.
   */
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
        if (quotation.status !== "pending") {
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
          { path: "serviceId", select: "name image serviceType depositAmount fixedPrice" },
          { path: "addressId", select: "ward province" },
        ],
      })
      .sort({ assignedAt: -1 })
      .lean();
  },

  /**
   * Get current repair quotation for an order (customer/provider view).
   */
  async getQuotationByOrder(
    orderId: string,
    userId: string,
    role: "CUSTOMER" | "PROVIDER",
  ) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);

    if (role === "CUSTOMER") {
      if (order.customerId.toString() !== userId) {
        throw new AppError("Bạn không có quyền xem báo giá của đơn hàng này.", 403);
      }
    } else {
      const provider = await Provider.findOne({
        userId,
        verified: true,
        isDeleted: false,
      });
      if (!provider) throw new AppError("Provider không tồn tại.", 404);
      if (
        !order.providerId ||
        order.providerId.toString() !== provider._id.toString()
      ) {
        throw new AppError("Bạn không có quyền xem báo giá của đơn hàng này.", 403);
      }
    }

    if (!order.currentQuotationId) {
      return null;
    }

    const quotation = await RepairQuotation.findById(order.currentQuotationId).lean();
    if (!quotation) return null;

    const items = await RepairQuotationItem.find({
      quotationId: quotation._id,
    }).lean();

    return { quotation, items };
  },
};
