import mongoose, { Types } from "mongoose";
import { randomBytes } from "crypto";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { RepairQuotationItem } from "../models/repairQuotationItem.model";
import { AppError } from "../utils/appError";
import { Address } from "../models/address.model";
import { isAddressInProviderWorkingAreas } from "../utils/providerArea";
import { emitToUser } from "../sockets/socketServer";
import { cancelOrderWithSettlement } from "./orderCancellation.service";
import { Payment } from "../models/payment.model";
import { assertProviderWalletEligible } from "./providerWalletEligibility.service";
import type { UserRole } from "../models/user.model";
import { createNotificationRecord } from "./notification.service";

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
  orderId: string;
  inspectionNote?: string;
  recommendation?: string;
  attachments?: string[];
  items: QuotationItemInput[];
  discountAmount?: number;
}

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
        "Thời gian phản hồi đã hết hạn. Hệ thống đang chuyển đơn sang provider khác.",
        400,
      );
    }

    const assignedOrder = await Order.findById(assignment.orderId).select(
      "addressId customerId orderCode orderType scheduledAt status recurringGroupId occurrenceNumber",
    );
    const assignedAddress = assignedOrder
      ? await Address.findById(assignedOrder.addressId).select("ward province")
      : null;
    if (
      !assignedAddress ||
      !isAddressInProviderWorkingAreas(
        provider.workingAreas,
        assignedAddress,
        provider.serviceArea,
      )
    ) {
      throw new AppError(
        "Địa chỉ thực hiện không thuộc khu vực phục vụ đã đăng ký của bạn.",
        400,
      );
    }

    await assertProviderWalletEligible(provider.userId);

    if (assignment.assignmentType === "appointment") {
      if (!assignedOrder || !assignedOrder.scheduledAt || assignedOrder.status !== "created") {
        throw new AppError("Lịch hẹn không còn khả dụng.", 409);
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
      const paymentDueAt = new Date(respondedAt.getTime() + 15 * 60 * 1000);
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

      let order;
      if (assignedOrder.recurringGroupId) {
        await Order.updateMany(
          {
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
            },
          },
          { runValidators: true },
        );
        order = await Order.findOneAndUpdate(
          { _id: assignment.orderId, status: "accepted" },
          { $set: { bookingStatus: "awaiting_payment", paymentDueAt } },
          { returnDocument: "after", runValidators: true },
        );
      } else {
        order = await Order.findOneAndUpdate(
          { _id: assignment.orderId, status: "created", providerId: null },
          {
            $set: {
              providerId: provider._id,
              status: "accepted",
              bookingStatus: "awaiting_payment",
              paymentDueAt,
            },
          },
          { returnDocument: "after", runValidators: true },
        );
      }
      if (!order) {
        await OrderAssignment.findByIdAndUpdate(claimedAssignment._id, {
          $set: { status: "cancelled" },
        });
        throw new AppError("Lịch hẹn vừa được xử lý bởi yêu cầu khác.", 409);
      }

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
        content: assignedOrder.recurringGroupId
          ? `Chuỗi lịch đã được xác nhận. Vui lòng thanh toán buổi đầu tiên trong 15 phút.`
          : `Vui lòng thanh toán đơn ${order.orderCode} trong 15 phút để giữ lịch.`,
        data: { orderId: order._id, paymentDueAt },
      });

      return {
        assignment: claimedAssignment as any,
        order: order as any,
      };
    }

    // 4. Khóa provider trước để không thể nhận đồng thời hai đơn.
    const claimedProvider = await Provider.findOneAndUpdate(
      { _id: provider._id, availabilityStatus: "online" },
      { $set: { availabilityStatus: "busy" } },
      { returnDocument: "after", runValidators: true },
    );
    if (!claimedProvider) {
      throw new AppError(
        "Bạn đang bận hoặc không còn sẵn sàng nhận đơn mới.",
        409,
      );
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
      await Provider.findOneAndUpdate(
        { _id: provider._id, availabilityStatus: "busy" },
        { $set: { availabilityStatus: "online" } },
      );
      throw new AppError(
        "Assignment không còn khả dụng hoặc đã hết thời gian phản hồi.",
        409,
      );
    }

    // 5. Chỉ một provider có thể chuyển đơn từ created sang accepted.
    const order = await Order.findOneAndUpdate(
      {
        _id: assignment.orderId,
        status: "created",
        providerId: null,
      },
      {
        $set: {
          providerId: provider._id,
          status: "accepted",
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!order) {
      await Promise.all([
        OrderAssignment.findByIdAndUpdate(claimedAssignment._id, {
          $set: { status: "cancelled" },
        }),
        Provider.findOneAndUpdate(
          { _id: provider._id, availabilityStatus: "busy" },
          { $set: { availabilityStatus: "online" } },
        ),
      ]);
      throw new AppError("Đơn hàng đã được xử lý bởi provider khác.", 409);
    }

    // 7. Cancel any other pending assignments for the same order
    await OrderAssignment.updateMany(
      {
        orderId: assignment.orderId,
        _id: { $ne: claimedAssignment._id },
        status: "pending",
      },
      { status: "cancelled" },
    );

    emitToUser(providerUserId, "assignment:closed", {
      assignmentId: assignment._id.toString(),
      reason: "accepted",
    });

    return {
      assignment: claimedAssignment as any,
      order: order as any,
    };
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
        "recurringGroupId",
      );
      if (appointmentOrder?.recurringGroupId) {
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

    // 4. Re-dispatch to next provider (import lazily to avoid circular dep)
    const order = await Order.findById(assignment.orderId);
    if (!order || order.status !== "created") return;

    const address = await (
      await import("../models/address.model.js")
    ).Address.findById(order.addressId);
    const service = await (
      await import("../models/service.model.js")
    ).Service.findById(order.serviceId);

    // Collect all tried providers from existing assignment history
    const triedAssignments = await OrderAssignment.find({
      orderId: rejectedAssignment.orderId,
      status: { $in: ["rejected", "timeout"] },
    }).lean();
    const triedProviderIds = triedAssignments.map((a) => a.providerId);

    const { DispatchService } = await import("./dispatch.service.js");
    await DispatchService.dispatchOrder(
      order._id.toString(),
      {
        latitude: address?.latitude,
        longitude: address?.longitude,
        serviceId: service?._id?.toString() || order.serviceId.toString(),
        province: address?.province || "",
        ward: address?.ward || "",
      },
      triedProviderIds,
      triedAssignments.length + 1,
    );
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
    if (!order.inspectionRequired) {
      throw new AppError(
        "Đơn hàng này không yêu cầu báo giá sửa chữa.",
        400,
      );
    }

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

    if (!["accepted", "in_progress"].includes(order.status)) {
      throw new AppError(
        "Chỉ có thể tạo báo giá khi đơn hàng đang ở trạng thái accepted hoặc in_progress.",
        400,
      );
    }

    // Calculate totals
    const subtotalAmount = payload.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const discountAmount = payload.discountAmount ?? 0;
    const finalAmount = Math.max(subtotalAmount - discountAmount, 0);
    if (finalAmount < order.depositAmount) {
      throw new AppError(
        "Tổng báo giá không được thấp hơn khoản đặt cọc khách hàng đã thanh toán.",
        400,
      );
    }

    const quotationCode = `QUO-${randomBytes(6).toString("hex").toUpperCase()}`;

    // Create quotation
    const quotation = await RepairQuotation.create({
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
    order.currentQuotationId = quotation._id as Types.ObjectId;
    order.hasAdditionalQuotation = true;
    await order.save();

    return quotation as any;
  },

  /**
   * Customer confirms (approves) the repair quotation.
   * After this, the repair work begins (order moves to in_progress).
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

        const [paymentSummary] = await Payment.aggregate<{ total: number }>([
          {
            $match: {
              orderId: order._id,
              status: "paid",
              isDeleted: { $ne: true },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]).session(session);
        const paidAmount = paymentSummary?.total || 0;
        const requiredAmount = quotation.finalAmount;
        const confirmedAt = new Date();

        quotation.status = "approved";
        quotation.customerConfirmed = true;
        quotation.approvedAt = confirmedAt;
        await quotation.save({ session });

        order.status = "in_progress";
        order.pricing.totalPaidAmount = requiredAmount;
        order.pricing.platformCommissionRate = 0;
        order.pricing.platformCommissionAmount = 0;
        order.pricing.providerEarningAmount = requiredAmount;
        order.paymentStatus =
          paidAmount >= requiredAmount
            ? "paid"
            : paidAmount > 0
              ? "partially_paid"
              : "unpaid";
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
        populate: [
          { path: "customerId", select: "fullName avatar phone" },
          { path: "serviceId", select: "name image serviceType depositAmount fixedPrice" },
          { path: "addressId" },
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
