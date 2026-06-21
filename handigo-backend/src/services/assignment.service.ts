import { Types } from "mongoose";
import { randomBytes } from "crypto";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { RepairQuotationItem } from "../models/repairQuotationItem.model";
import { AppError } from "../utils/appError";
import { Address } from "../models/address.model";
import { isAddressInProviderWorkingAreas } from "../utils/providerArea";

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
  providerId: string;
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
    const assignment = await OrderAssignment.findById(assignmentId);
    if (!assignment) throw new AppError("Assignment không tồn tại.", 404);

    // 2. Verify provider owns this assignment
    const provider = await Provider.findOne({ userId: providerUserId });
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
      assignment.status = "timeout";
      await assignment.save();
      throw new AppError(
        "Thời gian phản hồi đã hết hạn (timeout). Đơn hàng đã được chuyển sang provider khác.",
        400,
      );
    }

    const assignedOrder = await Order.findById(assignment.orderId).select("addressId");
    const assignedAddress = assignedOrder
      ? await Address.findById(assignedOrder.addressId).select("ward province")
      : null;
    if (
      !assignedAddress ||
      !isAddressInProviderWorkingAreas(provider.workingAreas, assignedAddress)
    ) {
      throw new AppError(
        "Địa chỉ thực hiện không thuộc khu vực phục vụ đã đăng ký của bạn.",
        400,
      );
    }

    // 4. Accept
    assignment.status = "accepted";
    assignment.respondedAt = new Date();
    await assignment.save();

    // 5. Update order
    const order = await Order.findByIdAndUpdate(
      assignment.orderId,
      {
        providerId: provider._id,
        status: "accepted",
      },
      { new: true },
    );
    if (!order) throw new AppError("Đơn hàng không tồn tại.", 404);

    // 6. Set provider as busy
    await Provider.findByIdAndUpdate(provider._id, {
      availabilityStatus: "busy",
    });

    // 7. Cancel any other pending assignments for the same order
    await OrderAssignment.updateMany(
      {
        orderId: assignment.orderId,
        _id: { $ne: assignment._id },
        status: "pending",
      },
      { status: "cancelled" },
    );

    return {
      assignment: assignment as any,
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
    const assignment = await OrderAssignment.findById(assignmentId);
    if (!assignment) throw new AppError("Assignment không tồn tại.", 404);

    // 2. Verify provider
    const provider = await Provider.findOne({ userId: providerUserId });
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

    // 3. Reject
    assignment.status = "rejected";
    assignment.rejectReason = rejectReason ?? null;
    assignment.respondedAt = new Date();
    await assignment.save();

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
      orderId: assignment.orderId,
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

    const provider = await Provider.findOne({ userId: providerUserId });
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
      throw new AppError("Bạn không có quyền xác nhận báo giá này.", 403);
    }

    quotation.status = "approved";
    quotation.customerConfirmed = true;
    quotation.approvedAt = new Date();
    await quotation.save();

    // Update order status to in_progress
    order.status = "in_progress";
    order.confirmation.customerConfirmedAt = new Date();
    await order.save();

    return quotation as any;
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

    order.status = "cancelled";
    order.cancellation = {
      cancelledBy: new Types.ObjectId(customerUserId),
      cancelledByRole: "customer",
      reason: `Từ chối báo giá sửa chữa: ${rejectionReason ?? "không có lý do"}`,
      cancelledAt: new Date(),
    };
    await order.save();

    return quotation as any;
  },

  /**
   * Get all assignments for an order (admin / audit).
   */
  async getAssignmentsByOrder(orderId: string) {
    return OrderAssignment.find({ orderId })
      .sort({ assignedAt: 1 })
      .populate("providerId", "userId averageRating totalCompletedOrders")
      .lean();
  },

  /**
   * Get pending assignment for the currently-logged-in provider.
   */
  async getPendingAssignmentForProvider(providerUserId: string) {
    const provider = await Provider.findOne({ userId: providerUserId });
    if (!provider) throw new AppError("Provider không tồn tại.", 404);

    return OrderAssignment.find({
      providerId: provider._id,
      status: "pending",
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
      const provider = await Provider.findOne({ userId });
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
